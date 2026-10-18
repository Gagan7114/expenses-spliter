import { useEffect, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import { useGroup, useGroupMutation, useGroups, useInbox } from '../api/hooks'
import type { Invite, User } from '../api/types'
import { Avatar, Badge, Button, Chips, Empty, FormError, GroupTile, Icon, Page, PageHeader, Section, Segmented, Spinner } from '../components/ui'

type Tab = 'invite' | 'join'

export function InviteJoinPage() {
  const [params, setParams] = useSearchParams()
  const inbox = useInbox()
  const tab: Tab = (params.get('tab') as Tab) ?? (inbox.data?.length ? 'join' : 'invite')
  const setTab = (t: Tab) => setParams((p) => { p.set('tab', t); p.delete('new'); return p }, { replace: true })

  return (
    <>
      <PageHeader title="Invite & join" />
      <Page>
        <Segmented label="Invite or join" value={tab} onChange={setTab}
          options={[
            { value: 'invite', label: <><Icon name="invite" size={18} /> Invite people</> },
            { value: 'join', label: <><Icon name="join" size={18} /> Join a group <Badge count={inbox.data?.length ?? 0} /></> },
          ]} />
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
        Create a group on the <Link to="/" className="font-semibold text-ink underline">Groups</Link> page first, then come back to invite people.
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
      {isNew && <p className="rounded-2xl bg-owed-bg px-4 py-3 font-semibold text-owed">{group.data.name} is ready. Now bring your people in.</p>}

      <div className="grid gap-4 md:grid-cols-2">
        <section className="flex flex-col gap-4 rounded-3xl bg-primary p-5 text-on-primary">
          <div>
            <h2 className="font-display text-lg font-bold">Share the invite</h2>
            <p className="text-sm opacity-80">Anyone with the code or link can join{expires ? ` until ${expires}` : ''}.</p>
          </div>
          <button onClick={() => doCopy('code', link.data.code)} aria-label="Copy invite code"
            className="flex items-center justify-between rounded-2xl bg-on-primary/10 px-5 py-4 transition hover:bg-on-primary/15">
            <span className="num font-display text-3xl font-extrabold tracking-[0.25em]">{link.data.code}</span>
            <span className="text-sm font-semibold opacity-80">{copied === 'code' ? 'Copied' : <Icon name="copy" />}</span>
          </button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="accent" onClick={share}><span className="flex items-center justify-center gap-2"><Icon name="share" size={18} /> Share</span></Button>
            <button onClick={() => doCopy('link', url)} className="min-h-12 rounded-2xl bg-on-primary/10 font-semibold transition hover:bg-on-primary/15">
              {copied === 'link' ? 'Copied' : 'Copy link'}
            </button>
          </div>
          <p className="break-all text-xs opacity-70 select-all">{url}</p>
          {group.data.my_role === 'admin' && (
            <button className="self-start text-sm font-semibold underline underline-offset-4 opacity-80 hover:opacity-100" disabled={reset.isPending}
              onClick={() => reset.mutate(undefined, { onSuccess: () => link.refetch() })}>
              Reset link (old link and code stop working)
            </button>
          )}
        </section>

        <DirectInvite groupId={groupId} onSent={() => pending.refetch()} />
      </div>

      {!!pending.data?.length && (
        <Section title="Waiting to accept">
          <ul className="flex flex-col divide-y divide-line rounded-2xl bg-surface">
            {pending.data.map((inv) => (
              <li key={inv.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={inv.invited_user!.display_name} size={34} />
                <span className="flex-1 font-medium">{inv.invited_user!.display_name} <span className="text-muted">@{inv.invited_user!.username}</span></span>
                <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-muted">invited</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title={`Already in ${group.data.name} (${members.length})`}>
        <div className="flex flex-wrap gap-2">
          {members.map((m) => (
            <span key={m.id} className="flex items-center gap-2 rounded-full bg-surface py-1 pl-1 pr-3 text-sm font-medium">
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
    <section className="flex flex-col gap-3 rounded-3xl bg-surface p-5">
      <div>
        <h2 className="font-display text-lg font-bold">Invite by user ID</h2>
        <p className="text-sm text-muted">They'll see it under Invite &amp; join → Join a group.</p>
      </div>
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); if (q.trim()) send(q.trim()) }} className="flex gap-2">
        <label className="flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-xl border border-line bg-bg px-3 focus-within:border-primary">
          <span className="text-muted"><Icon name="search" size={18} /></span>
          <input id="invite-search" placeholder="Search @username" autoCapitalize="none" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)}
            className="min-w-0 flex-1 bg-transparent outline-none" />
        </label>
        <Button type="submit" disabled={!q.trim() || invite.isPending}>Invite</Button>
      </form>
      {results.length > 0 && (
        <ul className="flex flex-col">
          {results.map((u) => (
            <li key={u.id}>
              <button onClick={() => send(u.username)} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-2 text-left hover:bg-surface-2">
                <Avatar name={u.display_name} size={32} />
                <span className="min-w-0 flex-1 truncate"><span className="font-semibold">{u.display_name}</span> <span className="text-muted">@{u.username}</span></span>
                <span className="text-sm font-semibold">Invite</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {sent && <p className="text-sm font-semibold text-owed">Invite sent to @{sent}</p>}
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
    <div className="grid gap-4 md:grid-cols-2 md:items-start">
      <section className="flex flex-col gap-4 rounded-3xl bg-surface p-5">
        <div>
          <h2 className="font-display text-lg font-bold">Have an invite code?</h2>
          <p className="text-sm text-muted">Ask someone in the group for their 6-character code.</p>
        </div>
        <form className="flex flex-col gap-3" onSubmit={(e: FormEvent) => { e.preventDefault(); navigate(`/join/${code}`) }}>
          <input id="invite-code" aria-label="Invite code" placeholder="X7K2QP" required minLength={6} maxLength={6}
            autoCapitalize="characters" autoComplete="off" spellCheck={false}
            value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            className="num min-h-16 rounded-2xl border-2 border-line bg-bg text-center font-display text-3xl font-extrabold tracking-[0.4em] outline-none placeholder:text-line focus:border-primary" />
          <Button type="submit" disabled={code.length !== 6}>Find group</Button>
        </form>
      </section>

      <Section title="Invites for you">
        {inbox.isPending ? <Spinner /> : !inbox.data?.length ? (
          <Empty title="No invites right now" icon="invite">When someone invites your user ID, it shows up here.</Empty>
        ) : (
          <ul className="flex flex-col gap-3">
            {inbox.data.map((inv) => (
              <li key={inv.id} className="flex flex-col gap-4 rounded-3xl border-2 border-accent/60 bg-surface p-4">
                <div className="flex items-center gap-3">
                  <GroupTile name={inv.group.name} />
                  <div className="min-w-0">
                    <p className="truncate font-display text-lg font-bold">{inv.group.name}</p>
                    <p className="truncate text-sm text-muted">from {inv.created_by.display_name} (@{inv.created_by.username})</p>
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
