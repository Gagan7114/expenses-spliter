import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { Button, Field, FormError } from '../components/ui'

function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col justify-center gap-8 px-5 py-10">
      <div className="flex flex-col gap-3">
        <span className="grid size-12 place-items-center rounded-2xl bg-primary">
          <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden><path d="M8 23L24 9" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round" /></svg>
        </span>
        <h1 className="font-display text-3xl font-extrabold leading-tight">{title}</h1>
        <p className="text-muted">{subtitle}</p>
      </div>
      {children}
    </main>
  )
}

function useNext() {
  const [params] = useSearchParams()
  const next = params.get('next')
  return next && next.startsWith('/') ? next : '/'
}

export function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const next = useNext()
  const [form, setForm] = useState({ login: '', password: '' })
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(undefined)
    try {
      await login(form.login, form.password)
      navigate(next, { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to see your groups and who owes what.">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field id="login" label="User ID or email" autoComplete="username" autoCapitalize="none" required
          value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} />
        <Field id="password" label="Password" type="password" autoComplete="current-password" required
          value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <Link className="-mt-2 self-end text-sm font-semibold text-muted underline underline-offset-4" to="/forgot-password">Forgot password?</Link>
        <FormError message={error} />
        <Button type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
      </form>
      <p className="text-center text-muted">
        New here? <Link className="font-semibold text-ink underline underline-offset-4" to={`/signup${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`}>Create an account</Link>
      </p>
    </AuthShell>
  )
}

export function Signup() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const next = useNext()
  const [form, setForm] = useState({ display_name: '', username: '', email: '', password: '' })
  const [err, setErr] = useState<ApiError>()
  const [busy, setBusy] = useState(false)
  const [idStatus, setIdStatus] = useState<{ available: boolean; reason?: string } | null>(null)

  // Live user ID availability, checked 350ms after typing stops.
  useEffect(() => {
    const id = form.username.trim()
    if (id.length < 3) { setIdStatus(null); return }
    const t = setTimeout(() => {
      api<{ available: boolean; reason?: string }>(`/users/check-id/?id=${encodeURIComponent(id)}`).then(setIdStatus).catch(() => setIdStatus(null))
    }, 350)
    return () => clearTimeout(t)
  }, [form.username])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErr(undefined)
    try {
      await register(form)
      navigate(next, { replace: true })
    } catch (e) {
      setErr(e instanceof ApiError ? e : new ApiError(0, { detail: 'Something went wrong. Try again.' }))
    } finally {
      setBusy(false)
    }
  }

  const idHint = idStatus
    ? idStatus.available
      ? <span className="text-owed">@{form.username.toLowerCase()} is available</span>
      : <span className="text-owes">{idStatus.reason}</span>
    : 'Friends find and invite you by this. Letters, numbers and _.'
  const fieldErrors = ['display_name', 'username', 'email', 'password'].some((f) => err?.field(f))

  return (
    <AuthShell title="Split costs, not friendships" subtitle="Create your account. It takes a minute.">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field id="display_name" label="Your name" autoComplete="name" required
          value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} error={err?.field('display_name')} />
        <Field id="username" label="User ID" autoComplete="username" autoCapitalize="none" required maxLength={20}
          value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.replace(/\s/g, '') })}
          error={err?.field('username')} hint={idHint} />
        <Field id="email" label="Email" type="email" autoComplete="email" required
          value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} error={err?.field('email')} />
        <Field id="new-password" label="Password" type="password" autoComplete="new-password" required minLength={8}
          value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
          error={err?.field('password') ?? err?.field('non_field_errors')} hint="At least 8 characters, not too common." />
        <FormError message={err && !fieldErrors && !err.field('non_field_errors') ? err.message : undefined} />
        <Button type="submit" disabled={busy || idStatus?.available === false}>{busy ? 'Creating account…' : 'Create account'}</Button>
      </form>
      <p className="text-center text-muted">
        Already have an account? <Link className="font-semibold text-ink underline underline-offset-4" to={`/login${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`}>Sign in</Link>
      </p>
    </AuthShell>
  )
}

export function ForgotPassword() {
  const [login, setLogin] = useState('')
  const [sent, setSent] = useState<string>()
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(undefined)
    try {
      const r = await api<{ detail: string }>('/auth/password-reset/', { method: 'POST', body: { login } })
      setSent(r.detail)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell title="Forgot your password?" subtitle="Enter your user ID or email and we'll send you a link to set a new one.">
      {sent ? (
        <p role="status" className="rounded-2xl bg-surface p-4">{sent} Check your inbox and spam folder.</p>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field id="login" label="User ID or email" autoComplete="username" autoCapitalize="none" required
            value={login} onChange={(e) => setLogin(e.target.value)} />
          <FormError message={error} />
          <Button type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</Button>
        </form>
      )}
      <p className="text-center text-muted">
        Remembered it? <Link className="font-semibold text-ink underline underline-offset-4" to="/login">Sign in</Link>
      </p>
    </AuthShell>
  )
}

export function ResetPassword() {
  const { resetPassword } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const uid = params.get('uid') ?? ''
  const token = params.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<ApiError>()
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErr(undefined)
    try {
      await resetPassword(uid, token, password)
      navigate('/', { replace: true })
    } catch (e) {
      setErr(e instanceof ApiError ? e : new ApiError(0, { detail: 'Something went wrong. Try again.' }))
    } finally {
      setBusy(false)
    }
  }

  if (!uid || !token) {
    return (
      <AuthShell title="Link not valid" subtitle="This reset link is incomplete. Ask for a new one.">
        <Link to="/forgot-password" className="text-center font-semibold text-ink underline underline-offset-4">Send a new reset link</Link>
      </AuthShell>
    )
  }

  const passwordError = err?.field('password')
  return (
    <AuthShell title="Choose a new password" subtitle="You'll be signed in once it's saved.">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field id="new-password" label="New password" type="password" autoComplete="new-password" required minLength={8}
          value={password} onChange={(e) => setPassword(e.target.value)}
          error={passwordError} hint="At least 8 characters, not too common." />
        <FormError message={err && !passwordError ? err.message : undefined} />
        <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</Button>
      </form>
      <p className="text-center text-muted">
        Link expired? <Link className="font-semibold text-ink underline underline-offset-4" to="/forgot-password">Send a new one</Link>
      </p>
    </AuthShell>
  )
}
