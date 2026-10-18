import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import { useGroup, useGroupMutation } from '../api/hooks'
import type { Member } from '../api/types'
import { BalancePill } from '../components/Balance'
import { Avatar, BottomSheet, Button, Field, FormError, Page, Spinner, TopBar } from '../components/ui'

type Confirm = { kind: 'leave' } | { kind: 'delete' } | { kind: 'remove'; member: Member } | null

export function MembersPage() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const group = useGroup(id)
  const [selected, setSelected] = useState<Member | null>(null)
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [name, setName] = useState<string | null>(null)

  const setRole = useGroupMutation(id, ({ member, role }: { member: number; role: string }) =>
    api(`/groups/${id}/members/${member}/`, { method: 'PATCH', body: { role } }))
  const removeMember = useGroupMutation(id, (member: number) => api(`/groups/${id}/members/${member}/`, { method: 'DELETE' }))
  const rename = useGroupMutation(id, (newName: string) => api(`/groups/${id}/`, { method: 'PATCH', body: { name: newName } }))
  const deleteGroup = useGroupMutation(null, () => api(`/groups/${id}/`, { method: 'DELETE' }))

  if (!group.data) return <><TopBar title="Members" back={`/groups/${id}`} /><Spinner /></>
  const g = group.data
  const isAdmin = g.my_role === 'admin'
  const active = g.members.filter((m) => m.is_active)
  const errorOf = (m: { error: unknown }) => (m.error instanceof ApiError ? m.error.message : undefined)

  return (
    <>
      <TopBar title="Group settings" back={`/groups/${id}`} />
      <Page>
        {isAdmin && (
          <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); if (name?.trim()) rename.mutate(name.trim(), { onSuccess: () => setName(null) }) }}>
            <Field id="rename" label="Group name" value={name ?? g.name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            {name !== null && name !== g.name && <Button type="submit" disabled={rename.isPending}>Save name</Button>}
          </form>
        )}

        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted">{active.length} {active.length === 1 ? 'member' : 'members'}</h2>
          <ul className="flex flex-col divide-y divide-line rounded-2xl bg-surface">
            {active.map((m) => (
              <li key={m.id}>
                <button disabled={!isAdmin || m.id === g.my_membership_id} onClick={() => setSelected(m)}
                  className="flex min-h-16 w-full items-center gap-3 px-4 py-2 text-left disabled:cursor-default">
                  <Avatar name={m.user.display_name} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{m.id === g.my_membership_id ? `${m.user.display_name} (you)` : m.user.display_name}</span>
                    <span className="block truncate text-sm text-muted">@{m.user.username}{m.role === 'admin' && ' · Admin'}</span>
                  </span>
                  <BalancePill cents={m.balance_cents} currency={g.currency} you={false} />
                </button>
              </li>
            ))}
          </ul>
          {isAdmin && <p className="px-1 text-sm text-muted">Tap a member to make them admin or remove them.</p>}
        </section>

        <FormError message={errorOf(setRole) ?? errorOf(removeMember)} />

        <section className="mt-4 flex flex-col gap-2">
          <Button variant="ghost" onClick={() => setConfirm({ kind: 'leave' })}>Leave group</Button>
          {isAdmin && <Button variant="danger" onClick={() => setConfirm({ kind: 'delete' })}>Delete group</Button>}
        </section>
      </Page>

      <BottomSheet open={!!selected} onClose={() => setSelected(null)} title={selected?.user.display_name ?? ''}>
        {selected && (
          <div className="flex flex-col gap-2">
            <Button variant="ghost" disabled={setRole.isPending}
              onClick={() => setRole.mutate({ member: selected.id, role: selected.role === 'admin' ? 'member' : 'admin' }, { onSettled: () => setSelected(null) })}>
              {selected.role === 'admin' ? 'Remove admin rights' : 'Make admin'}
            </Button>
            <Button variant="danger" onClick={() => { setConfirm({ kind: 'remove', member: selected }); setSelected(null) }}>Remove from group</Button>
          </div>
        )}
      </BottomSheet>

      <BottomSheet open={!!confirm} onClose={() => setConfirm(null)}
        title={confirm?.kind === 'leave' ? 'Leave this group?' : confirm?.kind === 'delete' ? 'Delete this group?' : `Remove ${confirm?.kind === 'remove' ? confirm.member.user.display_name : ''}?`}>
        <div className="flex flex-col gap-3">
          <p className="text-muted">
            {confirm?.kind === 'leave' && 'You can leave once your balance is zero. You can rejoin later with an invite.'}
            {confirm?.kind === 'delete' && `All expenses and payments in ${g.name} will be deleted for everyone. This can't be undone.`}
            {confirm?.kind === 'remove' && 'They lose access to the group. Their expenses and balance stay, so the group still adds up.'}
          </p>
          <FormError message={confirm?.kind === 'delete' ? errorOf(deleteGroup) : errorOf(removeMember)} />
          <Button variant="danger" disabled={removeMember.isPending || deleteGroup.isPending}
            onClick={() => {
              if (confirm?.kind === 'delete') deleteGroup.mutate(undefined, { onSuccess: () => navigate('/', { replace: true }) })
              else if (confirm?.kind === 'leave') removeMember.mutate(g.my_membership_id, { onSuccess: () => navigate('/', { replace: true }) })
              else if (confirm?.kind === 'remove') removeMember.mutate(confirm.member.id, { onSuccess: () => setConfirm(null) })
            }}>
            {confirm?.kind === 'leave' ? 'Leave group' : confirm?.kind === 'delete' ? 'Delete group' : 'Remove'}
          </Button>
          <Button variant="ghost" onClick={() => { setConfirm(null); removeMember.reset(); deleteGroup.reset() }}>Cancel</Button>
        </div>
      </BottomSheet>
    </>
  )
}
