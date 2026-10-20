import { useState, type FormEvent } from 'react'
import { api, ApiError } from '../api/client'
import type { User } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { Avatar, Button, Field, FormError, Page, PageHeader } from '../components/ui'

export function Profile() {
  const { user, setUser, logout } = useAuth()
  const [form, setForm] = useState({ display_name: user!.display_name, username: user!.username, upi_id: user!.upi_id ?? '' })
  const [err, setErr] = useState<ApiError>()
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(undefined); setSaved(false)
    try {
      setUser(await api<User>('/me/', { method: 'PATCH', body: form }))
      setSaved(true)
    } catch (e) {
      setErr(e as ApiError)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="Profile" />
      <Page>
        <div className="flex items-center gap-4 rounded-3xl bg-surface p-5">
          <Avatar name={user!.display_name} size={56} />
          <div className="min-w-0">
            <p className="truncate font-display text-xl font-bold">{user!.display_name}</p>
            <p className="truncate text-muted">@{user!.username} · {user!.email}</p>
          </div>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field id="profile-name" label="Name" required value={form.display_name}
            onChange={(e) => setForm({ ...form, display_name: e.target.value })} error={err?.field('display_name')} />
          <Field id="profile-username" label="User ID" required autoCapitalize="none" maxLength={20} value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value.replace(/\s/g, '') })} error={err?.field('username')}
            hint="Changing it won't affect your groups or balances." />
          <Field id="profile-upi" label="UPI ID" placeholder="name@okhdfcbank" autoCapitalize="none" inputMode="email" maxLength={100}
            value={form.upi_id} onChange={(e) => setForm({ ...form, upi_id: e.target.value.replace(/\s/g, '') })} error={err?.field('upi_id')}
            hint="People in your groups see this so they can pay you in one tap. Leave it empty to hide it." />
          {saved && <p className="text-sm font-semibold text-owed">Profile saved</p>}
          <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</Button>
        </form>
        <FormError message={err && !err.field('username') && !err.field('display_name') && !err.field('upi_id') ? err.message : undefined} />
        <Button variant="ghost" onClick={logout}>Sign out</Button>
      </Page>
    </>
  )
}
