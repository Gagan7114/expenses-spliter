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
  { to: '/', label: 'Groups', icon: 'groups', end: true, count: null },
  { to: '/details', label: 'Details', icon: 'details', end: false, count: null },
  { to: '/pending', label: 'Pending payments', short: 'Pending', icon: 'wallet', end: false, count: 'pending' },
  { to: '/invite', label: 'Invite & join', short: 'Invite', icon: 'invite', end: false, count: 'invites' },
] as const

/** Add expense opens the current group when you're inside one. */
function useAddLink() {
  const match = useMatch('/groups/:id/*')
  return match ? `/add?group=${match.params.id}` : '/add'
}

function Logo() {
  return (
    <span className="grid size-10 place-items-center rounded-xl bg-primary">
      <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden><path d="M8 23L24 9" stroke="var(--accent)" strokeWidth="4.5" strokeLinecap="round" /></svg>
    </span>
  )
}

function Sidebar() {
  const { user } = useAuth()
  const counts = useCounts()
  const addLink = useAddLink()
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col gap-6 border-r border-line bg-surface px-4 py-6 md:flex">
      <Link to="/" className="flex items-center gap-3 px-2">
        <Logo />
        <span className="font-display text-2xl font-extrabold">Tab</span>
      </Link>
      <Link to={addLink} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-accent font-semibold text-on-accent shadow-sm transition hover:brightness-105 active:scale-[.98]">
        <Icon name="plus" /> Add expense
      </Link>
      <nav className="flex flex-1 flex-col gap-1" aria-label="Main">
        {NAV.map((it) => (
          <NavLink key={it.to} to={it.to} end={it.end}
            className={({ isActive }) => `flex min-h-11 items-center gap-3 rounded-xl px-3 font-semibold transition ${isActive ? 'bg-surface-2 text-ink' : 'text-muted hover:bg-surface-2/60 hover:text-ink'}`}>
            {({ isActive }) => (
              <>
                <span className={isActive ? 'text-ink' : ''}><Icon name={it.icon} size={20} /></span>
                <span className="flex-1 whitespace-nowrap">{it.label}</span>
                {it.count && <Badge count={counts[it.count]} />}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      {user && (
        <NavLink to="/profile" className={({ isActive }) => `flex items-center gap-3 rounded-2xl p-2 transition ${isActive ? 'bg-surface-2' : 'hover:bg-surface-2/60'}`}>
          <Avatar name={user.display_name} size={38} />
          <span className="min-w-0">
            <span className="block truncate font-semibold">{user.display_name}</span>
            <span className="block truncate text-sm text-muted">@{user.username}</span>
          </span>
        </NavLink>
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
        className={({ isActive }) => `flex h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${isActive ? 'text-ink' : 'text-muted'}`}>
        {({ isActive }) => (
          <>
            <span className={`relative grid h-8 w-12 place-items-center rounded-full transition ${isActive ? 'bg-accent/25' : ''}`}>
              <Icon name={it.icon} size={21} />
              {it.count && counts[it.count] > 0 && <span className="absolute -right-0.5 -top-0.5"><Badge count={counts[it.count]} /></span>}
            </span>
            {'short' in it ? it.short : it.label}
          </>
        )}
      </NavLink>
    </li>
  )
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)', paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' }}>
      <ul className="mx-auto flex max-w-[520px] items-center">
        {item(NAV[0])}
        {item(NAV[1])}
        <li className="flex flex-1 justify-center">
          <NavLink to={addLink} aria-label="Add expense"
            className="-mt-6 grid size-14 place-items-center rounded-2xl bg-accent text-on-accent shadow-lg shadow-black/20 ring-4 ring-bg transition active:scale-95">
            <Icon name="plus" size={26} strokeWidth={2.5} />
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
    <div className="min-h-dvh md:pl-64">
      <Sidebar />
      {children}
      <MobileNav />
    </div>
  )
}
