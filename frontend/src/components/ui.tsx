import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import { useNavigate } from 'react-router-dom'
import { category, hueOf, tint } from '../lib/group'
import { Icon } from './icons'

export { Icon }

type Variant = 'primary' | 'accent' | 'ghost' | 'danger' | 'quiet'

const BUTTON: Record<Variant, string> = {
  primary: 'bg-primary text-on-primary hover:opacity-90',
  accent: 'bg-accent text-on-accent hover:brightness-95',
  ghost: 'border border-line bg-surface text-ink hover:border-line-strong hover:bg-surface-2',
  danger: 'bg-owes-bg text-owes hover:brightness-[.97]',
  quiet: 'text-muted hover:bg-surface-2 hover:text-ink',
}

/** Shared class string so links can look like buttons. */
export function buttonClass(variant: Variant = 'primary', size: 'md' | 'sm' = 'md') {
  return `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition active:scale-[.98] disabled:pointer-events-none disabled:opacity-45 ${size === 'sm' ? 'min-h-10 px-3.5 text-sm' : 'min-h-12 px-5 text-[15px]'} ${BUTTON[variant]}`
}

export function Button({ variant = 'primary', size = 'md', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'md' | 'sm' }) {
  return <button {...props} className={`${buttonClass(variant, size)} ${className}`} />
}

/** Round icon-only button for top bars and card corners. */
export function IconButton({ label, icon, tone, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; icon: string; tone?: 'danger' }) {
  return (
    <button aria-label={label} title={label} {...props}
      className={`grid size-10 shrink-0 place-items-center rounded-full transition hover:bg-surface-2 active:scale-95 disabled:opacity-30 ${tone === 'danger' ? 'text-owes' : 'text-ink'} ${className}`}>
      <Icon name={icon} size={20} />
    </button>
  )
}

const INPUT = 'min-h-12 w-full rounded-xl border bg-surface px-3.5 text-base outline-none transition placeholder:text-faint focus:border-ink focus:ring-4 focus:ring-ink/5'

export function Field({ label, error, hint, id, className = '', ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: ReactNode; id: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-muted">{label}</label>
      <input id={id} {...props} aria-invalid={!!error}
        className={`${INPUT} ${error ? 'border-owes' : 'border-line'} ${className}`} />
      {error ? <p className="text-[13px] text-owes">{error}</p> : hint ? <div className="text-[13px] text-muted">{hint}</div> : null}
    </div>
  )
}

export function Select({ label, hint, error, id, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: ReactNode; error?: string; id: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-muted">{label}</label>
      <div className="relative">
        <select id={id} {...props} className={`${INPUT} appearance-none pr-10 ${error ? 'border-owes' : 'border-line'}`}>{children}</select>
        <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-muted"><Icon name="down" size={18} /></span>
      </div>
      {error ? <p className="text-[13px] text-owes">{error}</p> : hint ? <div className="text-[13px] text-muted">{hint}</div> : null}
    </div>
  )
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p role="alert" className="flex items-start gap-2 rounded-xl bg-owes-bg px-3.5 py-3 text-sm font-medium text-owes">
      <span className="mt-px grid size-4 shrink-0 place-items-center rounded-full bg-owes text-[10px] font-bold text-white">!</span>
      {message}
    </p>
  )
}

/** Green confirmation strip ("Saved", "Invite sent"). */
export function Notice({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="flex items-center gap-2 rounded-xl bg-owed-bg px-3.5 py-3 text-sm font-semibold text-owed">
      <Icon name="check" size={16} strokeWidth={2.5} /> {children}
    </p>
  )
}

/** Sticky top bar for inner pages. Pass `back` for a back arrow. */
export function TopBar({ title, subtitle, back, action, wide }: { title: ReactNode; subtitle?: ReactNode; back?: string | true; action?: ReactNode; wide?: boolean }) {
  const navigate = useNavigate()
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur-md" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className={`mx-auto flex min-h-14 w-full items-center gap-1 px-2 md:min-h-16 md:px-6 ${wide ? 'max-w-6xl' : 'max-w-3xl'}`}>
        {back ? <IconButton label="Back" icon="back" onClick={() => (back === true ? navigate(-1) : navigate(back))} /> : <span className="w-2" />}
        <div className="min-w-0 flex-1 px-1">
          <h1 className="truncate text-[17px] font-semibold leading-tight">{title}</h1>
          {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
    </header>
  )
}

/** Big page heading for top-level pages (sidebar destinations). */
export function PageHeader({ eyebrow, title, action, wide }: { eyebrow?: ReactNode; title: ReactNode; action?: ReactNode; wide?: boolean }) {
  return (
    <header className={`mx-auto flex w-full items-end justify-between gap-3 px-4 md:px-8 ${wide ? 'max-w-6xl' : 'max-w-3xl'}`}
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 28px)' }}>
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-sm font-medium text-muted">{eyebrow}</p>}
        <h1 className="text-[28px] font-bold leading-[1.1] tracking-tight md:text-[34px]">{title}</h1>
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </header>
  )
}

export function Page({ children, className = '', wide }: { children: ReactNode; className?: string; wide?: boolean }) {
  return (
    <main className={`mx-auto flex w-full flex-col gap-6 px-4 pt-5 md:px-8 md:pt-7 ${wide ? 'max-w-6xl' : 'max-w-3xl'} ${className}`}
      style={{ paddingBottom: 'calc(var(--nav-h) + 88px)' }}>
      {children}
    </main>
  )
}

export function Section({ title, action, children, className = '' }: { title: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`flex flex-col gap-2.5 ${className}`}>
      <div className="flex min-h-6 items-center justify-between gap-3 px-0.5">
        <h2 className="text-[13px] font-semibold text-muted">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

/** Hairline-bordered white panel; the basic building block. */
export function Card({ children, className = '', as: Tag = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'section' | 'ul' | 'li' }) {
  return <Tag className={`rounded-2xl border border-line bg-surface ${className}`}>{children}</Tag>
}

/** A list inside a card, rows split by hairlines. */
export function List({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <ul className={`divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface ${className}`}>{children}</ul>
}

/** Bottom sheet on phones, centered dialog on wider screens. */
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
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className="animate-fade absolute inset-0 bg-[var(--overlay)] backdrop-blur-[2px]" onClick={onClose} />
      <div className="animate-sheet relative flex max-h-[92dvh] w-full max-w-[480px] flex-col overflow-hidden rounded-t-[28px] border border-line bg-surface shadow-2xl md:rounded-3xl">
        <div className="mx-auto mt-2.5 h-1 w-9 shrink-0 rounded-full bg-line-strong md:hidden" />
        <div className="flex shrink-0 items-center gap-2 px-5 pt-3 pb-2 md:pt-5">
          <h2 className="min-w-0 flex-1 text-lg font-semibold tracking-tight">{title}</h2>
          <IconButton label="Close" icon="close" onClick={onClose} className="-mr-2 text-muted" />
        </div>
        <div className="overflow-y-auto px-5 pt-2" style={{ paddingBottom: 'calc(20px + env(safe-area-inset-bottom))' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials = name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?'
  return (
    <span aria-hidden className="grid shrink-0 place-items-center rounded-full font-semibold tracking-tight ring-2 ring-surface"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38), ...tint(hueOf(name)) }}>
      {initials}
    </span>
  )
}

/** Overlapping avatars for "these people". */
export function AvatarStack({ names, size = 28, max = 4 }: { names: string[]; size?: number; max?: number }) {
  const extra = names.length - max
  return (
    <span className="flex items-center -space-x-1.5">
      {names.slice(0, max).map((n, i) => <Avatar key={i} name={n} size={size} />)}
      {extra > 0 && (
        <span className="grid shrink-0 place-items-center rounded-full bg-surface-2 text-[11px] font-semibold text-muted ring-2 ring-surface" style={{ width: size, height: size }}>
          +{extra}
        </span>
      )}
    </span>
  )
}

/** Rounded square with the group's first letter, colored per group. */
export function GroupTile({ name, size = 44 }: { name: string; size?: number }) {
  return (
    <span aria-hidden className="grid shrink-0 place-items-center font-bold tracking-tight"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42), borderRadius: size * 0.3, ...tint(hueOf(name)) }}>
      {name.trim()[0]?.toUpperCase() ?? '?'}
    </span>
  )
}

export function CategoryTile({ value, size = 40 }: { value: string; size?: number }) {
  const c = category(value)
  return (
    <span className="grid shrink-0 place-items-center" title={c.label} style={{ width: size, height: size, borderRadius: size * 0.3, ...tint(c.hue) }}>
      <Icon name={c.value} size={Math.round(size * 0.46)} />
    </span>
  )
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="grid gap-1 rounded-xl bg-surface-2 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)}
          className={`flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-semibold transition ${value === o.value ? 'bg-surface text-ink shadow-[0_1px_2px_rgb(0_0_0/0.08)] ring-1 ring-line' : 'text-muted hover:text-ink'}`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Horizontally scrolling filter chips. */
export function Chips<T extends string | number>({ value, options, onChange, label }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button type="button" key={String(o.value)} role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={`flex min-h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold transition ${value === o.value ? 'border-primary bg-primary text-on-primary' : 'border-line bg-surface text-muted hover:border-line-strong hover:text-ink'}`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Spinner() {
  return (
    <div className="grid place-items-center py-16" role="status" aria-label="Loading">
      <div className="size-6 animate-spin rounded-full border-2 border-line border-t-ink" />
    </div>
  )
}

/** Placeholder rows while a list loads. */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
          <span className="skeleton size-10 rounded-xl" />
          <span className="flex flex-1 flex-col gap-2">
            <span className="skeleton h-3.5 w-2/5 rounded" />
            <span className="skeleton h-3 w-3/5 rounded" />
          </span>
          <span className="skeleton h-4 w-14 rounded" />
        </div>
      ))}
    </div>
  )
}

export function Empty({ title, children, icon }: { title: string; children?: ReactNode; icon?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-surface px-6 py-12 text-center">
      {icon && <span className="mb-2 grid size-12 place-items-center rounded-full bg-surface-2 text-muted"><Icon name={icon} /></span>}
      <p className="text-base font-semibold">{title}</p>
      {children && <div className="max-w-sm text-sm leading-relaxed text-muted">{children}</div>}
    </div>
  )
}

/** Small count bubble for nav items. */
export function Badge({ count }: { count: number }) {
  if (!count) return null
  return <span className="num grid h-[18px] min-w-[18px] place-items-center rounded-full bg-owes px-1 text-[10px] font-bold text-white">{count > 9 ? '9+' : count}</span>
}

/** Label over a big number. `tone` colors it as owed/owes. */
export function Stat({ label, value, tone, sub }: { label: ReactNode; value: ReactNode; tone?: 'owed' | 'owes'; sub?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-2xl border border-line bg-surface p-4">
      <span className="truncate text-[13px] font-medium text-muted">{label}</span>
      <span className={`num truncate text-xl font-bold tracking-tight md:text-2xl ${tone === 'owed' ? 'text-owed' : tone === 'owes' ? 'text-owes' : ''}`}>{value}</span>
      {sub && <span className="truncate text-xs text-muted">{sub}</span>}
    </div>
  )
}
