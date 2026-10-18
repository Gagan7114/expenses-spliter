import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { category, hueOf, tint } from '../lib/group'
import { Icon } from './icons'

export { Icon }

export function Button({ variant = 'primary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'accent' | 'ghost' | 'danger' }) {
  const styles = {
    primary: 'bg-primary text-on-primary',
    accent: 'bg-accent text-on-accent',
    ghost: 'bg-surface-2 text-ink',
    danger: 'bg-owes-bg text-owes',
  }[variant]
  return (
    <button
      {...props}
      className={`min-h-12 rounded-2xl px-5 font-semibold transition hover:brightness-105 active:scale-[.98] disabled:opacity-50 disabled:active:scale-100 ${styles} ${className}`}
    />
  )
}

export function Field({ label, error, hint, id, className = '', ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: ReactNode; id: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-muted">{label}</label>
      <input
        id={id}
        {...props}
        className={`min-h-12 w-full rounded-xl border bg-surface px-4 text-base outline-none transition focus:border-primary ${error ? 'border-owes' : 'border-line'} ${className}`}
        aria-invalid={!!error}
      />
      {error ? <p className="text-sm text-owes">{error}</p> : hint ? <div className="text-sm text-muted">{hint}</div> : null}
    </div>
  )
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null
  return <p role="alert" className="rounded-xl bg-owes-bg px-4 py-3 text-sm text-owes">{message}</p>
}

/** Sticky top bar for inner pages. Pass `back` for a back arrow. */
export function TopBar({ title, back, action }: { title: ReactNode; back?: string | true; action?: ReactNode }) {
  const navigate = useNavigate()
  return (
    <header className="sticky top-0 z-20 border-b border-line/60 bg-bg/90 backdrop-blur" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="mx-auto flex min-h-14 w-full max-w-3xl items-center gap-1 px-2 md:px-6">
        {back ? (
          <button
            aria-label="Back"
            onClick={() => (back === true ? navigate(-1) : navigate(back))}
            className="grid size-11 place-items-center rounded-full text-ink hover:bg-surface-2 active:bg-surface-2"
          >
            <Icon name="back" />
          </button>
        ) : <span className="w-2" />}
        <h1 className="min-w-0 flex-1 truncate font-display text-lg font-bold">{title}</h1>
        {action}
      </div>
    </header>
  )
}

/** Big page heading for top-level pages (sidebar destinations). */
export function PageHeader({ eyebrow, title, action }: { eyebrow?: ReactNode; title: ReactNode; action?: ReactNode }) {
  return (
    <header className="mx-auto flex w-full max-w-3xl items-end justify-between gap-3 px-4 md:px-8" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 24px)' }}>
      <div className="min-w-0">
        {eyebrow && <p className="text-sm font-semibold text-muted">{eyebrow}</p>}
        <h1 className="font-display text-3xl font-extrabold md:text-4xl">{title}</h1>
      </div>
      {action}
    </header>
  )
}

export function Page({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <main className={`mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 pt-4 md:px-8 md:pt-6 ${className}`}
      style={{ paddingBottom: 'calc(var(--nav-h) + 96px)' }}>
      {children}
    </main>
  )
}

export function Section({ title, action, children }: { title: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export function BottomSheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="animate-fade absolute inset-0 bg-[var(--overlay)]" onClick={onClose} />
      <div
        className="animate-sheet relative max-h-[90dvh] w-full max-w-[480px] overflow-y-auto rounded-t-3xl bg-surface px-5 pt-3 md:rounded-3xl md:pt-6"
        style={{ paddingBottom: 'calc(20px + env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line md:hidden" />
        <h2 className="mb-4 font-display text-xl font-bold">{title}</h2>
        {children}
      </div>
    </div>
  )
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials = name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?'
  return (
    <span aria-hidden className="grid shrink-0 place-items-center rounded-full font-semibold"
      style={{ width: size, height: size, fontSize: size * 0.38, ...tint(hueOf(name)) }}>
      {initials}
    </span>
  )
}

/** Rounded square with the group's first letter, colored per group. */
export function GroupTile({ name, size = 44 }: { name: string; size?: number }) {
  return (
    <span aria-hidden className="grid shrink-0 place-items-center rounded-xl font-display font-extrabold"
      style={{ width: size, height: size, fontSize: size * 0.42, ...tint(hueOf(name)) }}>
      {name.trim()[0]?.toUpperCase() ?? '?'}
    </span>
  )
}

export function CategoryTile({ value, size = 40 }: { value: string; size?: number }) {
  const c = category(value)
  return (
    <span className="grid shrink-0 place-items-center rounded-xl" title={c.label} style={{ width: size, height: size, ...tint(c.hue) }}>
      <Icon name={c.value} size={size * 0.48} />
    </span>
  )
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="grid rounded-2xl bg-surface-2 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)}
          className={`flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-2 text-sm font-semibold transition ${value === o.value ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'}`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Horizontally scrolling filter chips. */
export function Chips<T extends string | number>({ value, options, onChange, label }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button type="button" key={String(o.value)} role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={`flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition ${value === o.value ? 'border-primary bg-primary text-on-primary' : 'border-line bg-surface text-muted hover:text-ink'}`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Spinner() {
  return <div className="grid place-items-center py-16" aria-label="Loading"><div className="size-7 animate-spin rounded-full border-[3px] border-line border-t-primary" /></div>
}

export function Empty({ title, children, icon }: { title: string; children?: ReactNode; icon?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-line px-6 py-10 text-center">
      {icon && <span className="mb-1 grid size-12 place-items-center rounded-2xl bg-surface-2 text-muted"><Icon name={icon} /></span>}
      <p className="font-display text-lg font-bold">{title}</p>
      {children && <div className="text-sm text-muted">{children}</div>}
    </div>
  )
}

/** Small count bubble for nav items. */
export function Badge({ count }: { count: number }) {
  if (!count) return null
  return <span className="num grid h-5 min-w-5 place-items-center rounded-full bg-owes px-1.5 text-[11px] font-bold text-white">{count > 9 ? '9+' : count}</span>
}
