import { useEffect, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import { useGroup, useGroupMutation, useGroups, useInbox } from '../api/hooks'
import type { Invite, User } from '../api/types'
import { Avatar, Badge, Button, Chips, Empty, FormError, GroupTile, Icon, List, Notice, Page, PageHeader, Section, Segmented, Spinner } from '../components/ui'

type Tab = 'invite' | 'join'

export function InviteJoinPage() {
  const [params, setParams] = useSearchParams()
  const inbox = useInbox()
  const tab: Tab = (params.get('tab') as Tab) ?? (inbox.data?.length ? 'join' : 'invite')
  const setTab = (t: Tab) => setParams((p) => { p.set('tab', t); p.delete('new'); return p }, { replace: true })

  return (
    <>
      <PageHeader wide title="Invite & join" />
      <Page wide>
        <div className="md:max-w-md"><Segmented label="Invite or join" value={tab} onChange={setTab}
          options={[
            { value: 'invite', label: <><Icon name="invite" size={18} /> Invite people</> },
            { value: 'join', label: <><Icon name="join" size={18} /> Join a group <Badge count={inbox.data?.length ?? 0} /></> },
          ]} /></div>
        {tab === 'invite' ? <InviteTab /> : <JoinTab />}
      </Page>
    </>
  )
}

function InviteTab() {
  const [params, setParams] = useSearchParams()
  const groups = useGroups()
  const list = groups.data ?? []
  const groupId = Number(params.get('group')) || list[0]?.id || 0
  const isNew = params.get('new') === '1'

  if (groups.isPending) return <Spinner />
  if (!list.length) {
    return (
      <Empty title="No groups to invite to" icon="groups">
        Create a group on the <Link to="/" className="font-semibold text-ink underline underline-offset-2">Groups</Link> page first, then come back to invite people.
      </Empty>
    )
  }
  return (
    <>
      <Section title="Choose a group">
        <Chips label="Group" value={groupId}
          onChange={(id) => setParams((p) => { p.set('group', String(id)); p.delete('new'); return p }, { replace: true })}
          options={list.map((g) => ({ value: g.id, label: <><GroupTile name={g.name} size={22} /> {g.name}</> }))} />
      </Section>
      {groupId > 0 && <GroupInvite key={groupId} groupId={groupId} isNew={isNew} />}
    </>
  )
}

async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); return true } catch { return false }
}

function GroupInvite({ groupId, isNew }: { groupId: number; isNew: boolean }) {
  const group = useGroup(groupId)
  const link = useQuery({ queryKey: ['group', groupId, 'invite-link'], queryFn: () => api<Invite>(`/groups/${groupId}/invite-link/`) })
  const pending = useQuery({ queryKey: ['group', groupId, 'invites'], queryFn: () => api<Invite[]>(`/groups/${groupId}/invites/`) })
  const reset = useGroupMutation(groupId, () => api<Invite>(`/groups/${groupId}/invite-link/reset/`, { method: 'POST' }))
  const [copied, setCopied] = useState<string | null>(null)

  if (!group.data || !link.data) return <Spinner />
  const url = `${window.location.origin}/join/${link.data.code}`
  const shareText = `Join "${group.data.name}" on Tab to split expenses: ${url}`
  const expires = link.data.expires_at ? new Date(link.data.expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : null
  const members = group.data.members.filter((m) => m.is_active)

  async function doCopy(what: string, text: string) {
    if (await copyText(text)) { setCopied(what); setTimeout(() => setCopied(null), 1800) }
  }
  async function share() {
    if (navigator.share) {
      try { await navigator.share({ title: group.data!.name, text: shareText, url }) } catch { /* cancelled */ }
    } else doCopy('link', shareText)
  }

  return (
    <>
      {isNew && <Notice>{group.data.name} is ready. Now bring your people in.</Notice>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-start">
        <section className="relative flex flex-col gap-4 overflow-hidden rounded-3xl bg-hero p-5 text-hero-ink md:p-6">
          <div className="pointer-events-none absolute -top-20 -right-20 size-56 rounded-full bg-accent/10 blur-3xl" />
          <div className="relative">
            <h2 className="text-lg font-semibold tracking-tight">Share the invite</h2>
            <p className="text-[13px] text-hero-muted">Anyone with the code or link can join{expires ? ` until ${expires}` : ''}.</p>
          </div>
          <button onClick={() => doCopy('code', link.data.code)} aria-label="Copy invite code"
            className="relative flex items-center justify-between rounded-2xl border border-dashed border-white/15 bg-hero-2 px-5 py-4 transition hover:border-accent/60">
            <span className="font-mono text-3xl font-semibold tracking-[0.3em] text-accent">{link.data.code}</span>
            <span className="text-sm font-semibold text-hero-muted">{copied === 'code' ? 'Copied' : <Icon name="copy" />}</span>
          </button>
          <div className="relative grid grid-cols-2 gap-2">
            <Button variant="accent" onClick={share}><Icon name="share" size={18} /> Share</Button>
            <button onClick={() => doCopy('link', url)} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-hero-2 text-[15px] font-semibold transition hover:bg-white/10">
              <Icon name={copied === 'link' ? 'check' : 'copy'} size={17} />
              {copied === 'link' ? 'Copied' : 'Copy link'}
            </button>
          </div>
          <p className="relative font-mono text-xs break-all text-hero-muted select-all">{url}</p>
          {group.data.my_role === 'admin' && (
            <button className="relative self-start text-[13px] font-semibold text-hero-muted underline underline-offset-4 hover:text-hero-ink" disabled={reset.isPending}
              onClick={() => reset.mutate(undefined, { onSuccess: () => link.refetch() })}>
              Reset link (old link and code stop working)
            </button>
          )}
        </section>

        <DirectInvite groupId={groupId} onSent={() => pending.refetch()} />
      </div>

      {!!pending.data?.length && (
        <Section title="Waiting to accept">
          <List>
            {pending.data.map((inv) => (
              <li key={inv.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={inv.invited_user!.display_name} size={34} />
                <span className="min-w-0 flex-1 truncate font-medium">{inv.invited_user!.display_name} <span className="text-muted">@{inv.invited_user!.username}</span></span>
                <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-muted">invited</span>
              </li>
            ))}
          </List>
        </Section>
      )}

      <Section title={`Already in ${group.data.name} (${members.length})`}>
        <div className="flex flex-wrap gap-2">
          {members.map((m) => (
            <span key={m.id} className="flex items-center gap-2 rounded-full border border-line bg-surface py-1 pr-3 pl-1 text-sm font-medium">
              <Avatar name={m.user.display_name} size={26} />{m.id === group.data!.my_membership_id ? 'You' : m.user.display_name}
            </span>
          ))}
        </div>
      </Section>
    </>
  )
}

function DirectInvite({ groupId, onSent }: { groupId: number; onSent: () => void }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<User[]>([])
  const [sent, setSent] = useState<string | null>(null)
  const invite = useGroupMutation(groupId, (username: string) => api<Invite>(`/groups/${groupId}/invites/`, { method: 'POST', body: { username } }))

  useEffect(() => {
    const term = q.trim().replace(/^@/, '')
    if (term.length < 2) { setResults([]); return }
    const t = setTimeout(() => api<User[]>(`/users/search/?q=${encodeURIComponent(term)}`).then(setResults).catch(() => setResults([])), 250)
    return () => clearTimeout(t)
  }, [q])

  function send(username: string) {
    setSent(null)
    invite.mutate(username, { onSuccess: () => { setSent(username); setQ(''); setResults([]); onSent() } })
  }

  return (
    <section className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-5 md:p-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Invite by user ID</h2>
        <p className="text-[13px] text-muted">They'll see it under Invite &amp; join → Join a group.</p>
      </div>
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); if (q.trim()) send(q.trim()) }} className="flex gap-2">
        <label className="flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-xl border border-line bg-surface px-3 transition focus-within:border-ink focus-within:ring-4 focus-within:ring-ink/5">
          <span className="text-faint"><Icon name="search" size={18} /></span>
          <input id="invite-search" placeholder="Search @username" autoCapitalize="none" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)}
            className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-faint" />
        </label>
        <Button type="submit" disabled={!q.trim() || invite.isPending}>Invite</Button>
      </form>
      {results.length > 0 && (
        <ul className="-mt-1 flex flex-col rounded-xl border border-line p-1">
          {results.map((u) => (
            <li key={u.id}>
              <button onClick={() => send(u.username)} className="flex min-h-12 w-full items-center gap-3 rounded-lg px-2 text-left transition hover:bg-surface-2">
                <Avatar name={u.display_name} size={32} />
                <span className="min-w-0 flex-1 truncate"><span className="font-semibold">{u.display_name}</span> <span className="text-muted">@{u.username}</span></span>
                <span className="rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-on-primary">Invite</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {sent && <Notice>Invite sent to @{sent}</Notice>}
      <FormError message={invite.error instanceof ApiError ? invite.error.message : undefined} />
    </section>
  )
}

function JoinTab() {
  const navigate = useNavigate()
  const inbox = useInbox()
  const [code, setCode] = useState('')
  const respond = useGroupMutation(null, ({ id, action }: { id: number; action: 'accept' | 'decline' }) =>
    api<{ group_id: number; status: string }>(`/invites/${id}/${action}/`, { method: 'POST' }))

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-start">
      <section className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-5 md:p-6">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Have an invite code?</h2>
          <p className="text-[13px] text-muted">Ask someone in the group for their 6-character code.</p>
        </div>
        <form className="flex flex-col gap-3" onSubmit={(e: FormEvent) => { e.preventDefault(); navigate(`/join/${code}`) }}>
          <input id="invite-code" aria-label="Invite code" placeholder="X7K2QP" required minLength={6} maxLength={6}
            autoCapitalize="characters" autoComplete="off" spellCheck={false}
            value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            className="min-h-16 rounded-2xl border border-line bg-surface-2 text-center font-mono text-3xl font-semibold tracking-[0.4em] uppercase outline-none transition placeholder:text-line-strong focus:border-ink focus:bg-surface focus:ring-4 focus:ring-ink/5" />
          <Button type="submit" disabled={code.length !== 6}>Find group</Button>
        </form>
      </section>

      <Section title="Invites for you">
        {inbox.isPending ? <Spinner /> : !inbox.data?.length ? (
          <Empty title="No invites right now" icon="invite">When someone invites your user ID, it shows up here.</Empty>
        ) : (
          <ul className="flex flex-col gap-3">
            {inbox.data.map((inv) => (
              <li key={inv.id} className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4 ring-1 ring-accent ring-offset-0">
                <div className="flex items-center gap-3">
                  <GroupTile name={inv.group.name} />
                  <div className="min-w-0">
                    <p className="truncate text-[17px] font-semibold">{inv.group.name}</p>
                    <p className="truncate text-[13px] text-muted">from {inv.created_by.display_name} (@{inv.created_by.username})</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1" disabled={respond.isPending}
                    onClick={() => respond.mutate({ id: inv.id, action: 'accept' }, { onSuccess: (r) => navigate(`/groups/${r.group_id}`) })}>
                    Join group
                  </Button>
                  <Button variant="ghost" disabled={respond.isPending} onClick={() => respond.mutate({ id: inv.id, action: 'decline' })}>Decline</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}
