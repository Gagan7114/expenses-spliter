import type { ReactNode } from 'react'
import { Link, NavLink, useMatch } from 'react-router-dom'
import { useInbox, usePending } from '../api/hooks'
import { useAuth } from '../auth/AuthContext'
import { Avatar, Badge, Icon } from './ui'

function useCounts() {
  const inbox = useInbox()
  const pending = usePending()
  const mine = (pending.data ?? []).reduce(
    (n, g) => n + g.payments.filter((p) => p.from.id === g.group.my_membership_id || p.to.id === g.group.my_membership_id).length, 0)
  return { invites: inbox.data?.length ?? 0, pending: mine }
}

const NAV = [
  { to: '/', label: 'Groups', icon: 'home', end: true, count: null },
  { to: '/details', label: 'Activity', icon: 'activity', end: false, count: null },
  { to: '/pending', label: 'Pending payments', short: 'Pending', icon: 'wallet', end: false, count: 'pending' },
  { to: '/invite', label: 'Invite & join', short: 'Invite', icon: 'invite', end: false, count: 'invites' },
  { to: '/daily', label: 'Daily items', icon: 'milk', end: false, count: null },
] as const

/** Add expense opens the current group when you're inside one. */
function useAddLink() {
  const match = useMatch('/groups/:id/*')
  return match ? `/add?group=${match.params.id}` : '/add'
}

export function Logo({ size = 36 }: { size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center bg-[#121316] ring-1 ring-white/10" style={{ width: size, height: size, borderRadius: size * 0.3 }}>
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 32 32" aria-hidden><path d="M9 23L23 9" stroke="#c8f04a" strokeWidth="5" strokeLinecap="round" /></svg>
    </span>
  )
}

function Sidebar() {
  const { user } = useAuth()
  const counts = useCounts()
  const addLink = useAddLink()
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-line bg-surface md:flex">
      <Link to="/" className="flex h-16 items-center gap-2.5 px-5">
        <Logo size={30} />
        <span className="text-xl font-bold tracking-tight">Tab</span>
      </Link>
      <div className="px-3 pt-2 pb-4">
        <Link to={addLink} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent text-[15px] font-semibold text-on-accent transition hover:brightness-95 active:scale-[.98]">
          <Icon name="plus" size={18} strokeWidth={2.5} /> Add expense
        </Link>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 px-3" aria-label="Main">
        {NAV.map((it) => (
          <NavLink key={it.to} to={it.to} end={it.end}
            className={({ isActive }) => `group flex min-h-10 items-center gap-3 rounded-lg px-3 text-[14px] font-medium transition ${isActive ? 'bg-surface-2 font-semibold text-ink' : 'text-muted hover:bg-surface-2/70 hover:text-ink'}`}>
            <Icon name={it.icon} size={18} />
            <span className="flex-1 whitespace-nowrap">{it.label}</span>
            {it.count && <Badge count={counts[it.count]} />}
          </NavLink>
        ))}
      </nav>
      {user && (
        <div className="border-t border-line p-3">
          <NavLink to="/profile" className={({ isActive }) => `flex items-center gap-3 rounded-xl p-2 transition ${isActive ? 'bg-surface-2' : 'hover:bg-surface-2/70'}`}>
            <Avatar name={user.display_name} size={34} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{user.display_name}</span>
              <span className="block truncate text-xs text-muted">@{user.username}</span>
            </span>
            <span className="text-faint"><Icon name="settings" size={16} /></span>
          </NavLink>
        </div>
      )}
    </aside>
  )
}

function MobileNav() {
  const counts = useCounts()
  const addLink = useAddLink()
  const item = (it: (typeof NAV)[number]) => (
    <li key={it.to} className="flex-1">
      <NavLink to={it.to} end={it.end}
        className={({ isActive }) => `flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition ${isActive ? 'text-ink' : 'text-faint'}`}>
        {({ isActive }) => (
          <>
            <span className="relative">
              <Icon name={it.icon} size={22} strokeWidth={isActive ? 2.3 : 1.9} />
              {it.count && counts[it.count] > 0 && <span className="absolute -top-1.5 -right-2.5"><Badge count={counts[it.count]} /></span>}
            </span>
            {'short' in it ? it.short : it.label}
          </>
        )}
      </NavLink>
    </li>
  )
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/90 backdrop-blur-md md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)', paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' }}>
      <ul className="mx-auto flex max-w-[520px] items-center">
        {item(NAV[0])}
        {item(NAV[1])}
        <li className="flex flex-1 justify-center">
          <NavLink to={addLink} aria-label="Add expense"
            className="grid size-12 place-items-center rounded-2xl bg-accent text-on-accent shadow-[0_6px_16px_-4px_rgb(120_160_0/0.55)] transition active:scale-95">
            <Icon name="plus" size={24} strokeWidth={2.6} />
          </NavLink>
        </li>
        {item(NAV[2])}
        {item(NAV[3])}
      </ul>
    </nav>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh md:pl-[248px]">
      <Sidebar />
      {children}
      <MobileNav />
    </div>
  )
}
