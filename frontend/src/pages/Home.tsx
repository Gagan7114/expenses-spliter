import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import { useGroupMutation, useGroups, useInbox } from '../api/hooks'
import type { GroupDetail, GroupType } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { BalancePill } from '../components/Balance'
import { Avatar, BottomSheet, Button, Empty, Field, FormError, GroupTile, Icon, Page, PageHeader, Section, Spinner } from '../components/ui'
import { formatMoney } from '../lib/money'

export const TYPE_LABEL: Record<GroupType, string> = { trip: 'Trip', household: 'Home', other: 'Group' }

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export function Home() {
  const { user } = useAuth()
  const groups = useGroups()
  const inbox = useInbox()
  const [creating, setCreating] = useState(false)

  // Totals use the most common currency across groups.
  const list = groups.data ?? []
  const currency = Object.entries(list.reduce((a, g) => ({ ...a, [g.currency]: (a[g.currency] ?? 0) + 1 }), {} as Record<string, number>))
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'INR'
  const same = list.filter((g) => g.currency === currency)
  const owed = same.reduce((s, g) => s + Math.max(g.my_balance_cents, 0), 0)
  const owe = same.reduce((s, g) => s + Math.min(g.my_balance_cents, 0), 0)

  return (
    <>
      <PageHeader
        eyebrow={`${greeting()}, ${user?.display_name.split(' ')[0]}`}
        title="Your groups"
        action={
          <>
            <Button className="hidden md:block" variant="ghost" onClick={() => setCreating(true)}>New group</Button>
            <Link to="/profile" aria-label="Profile" className="md:hidden"><Avatar name={user?.display_name ?? '?'} size={42} /></Link>
          </>
        }
      />
      <Page>
        {!!inbox.data?.length && (
          <Link to="/invite?tab=join" className="flex items-center gap-3 rounded-2xl border-2 border-accent/70 bg-surface p-4 transition hover:bg-surface-2/50">
            <span className="grid size-10 place-items-center rounded-xl bg-accent text-on-accent"><Icon name="invite" size={20} /></span>
            <span className="flex-1">
              <span className="block font-semibold">{inbox.data.length === 1 ? `${inbox.data[0].created_by.display_name} invited you to ${inbox.data[0].group.name}` : `${inbox.data.length} group invites waiting`}</span>
              <span className="text-sm text-muted">Tap to accept or decline</span>
            </span>
            <Icon name="chevron" size={20} />
          </Link>
        )}

        {list.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <Link to="/pending" className="flex flex-col gap-1 rounded-3xl bg-owed-bg p-4 transition hover:brightness-[1.03]">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-owed"><Icon name="in" size={16} /> You'll get back</span>
              <span className="num font-display text-2xl font-extrabold text-owed md:text-3xl">{formatMoney(owed, currency)}</span>
            </Link>
            <Link to="/pending" className="flex flex-col gap-1 rounded-3xl bg-owes-bg p-4 transition hover:brightness-[1.03]">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-owes"><Icon name="out" size={16} /> You owe</span>
              <span className="num font-display text-2xl font-extrabold text-owes md:text-3xl">{formatMoney(owe, currency)}</span>
            </Link>
          </div>
        )}

        {groups.isPending ? <Spinner /> : list.length === 0 ? (
          <Empty title="No groups yet" icon="groups">
            Create one for your flat or next trip, or join a friend's group with their invite code.
            <div className="mt-4 flex justify-center gap-2">
              <Button onClick={() => setCreating(true)}>Create group</Button>
              <Link to="/invite?tab=join" className="grid min-h-12 place-items-center rounded-2xl bg-surface-2 px-5 font-semibold text-ink">Join with code</Link>
            </div>
          </Empty>
        ) : (
          <Section title={`${list.length} ${list.length === 1 ? 'group' : 'groups'}`}>
            <ul className="grid gap-3 md:grid-cols-2">
              {list.map((g) => (
                <li key={g.id}>
                  <Link to={`/groups/${g.id}`} className="flex h-full flex-col gap-4 rounded-3xl bg-surface p-4 transition hover:shadow-md hover:shadow-black/5 active:scale-[.99]">
                    <div className="flex items-center gap-3">
                      <GroupTile name={g.name} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-display text-lg font-bold">{g.name}</span>
                        <span className="text-sm text-muted">{TYPE_LABEL[g.type]} · {g.member_count} {g.member_count === 1 ? 'person' : 'people'}</span>
                      </span>
                      <span className="text-muted"><Icon name="chevron" size={20} /></span>
                    </div>
                    <span className="self-start"><BalancePill cents={g.my_balance_cents} currency={g.currency} /></span>
                  </Link>
                </li>
              ))}
              <li>
                <button onClick={() => setCreating(true)}
                  className="flex h-full min-h-28 w-full flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-line font-semibold text-muted transition hover:border-primary hover:text-ink">
                  <Icon name="plus" /> New group
                </button>
              </li>
            </ul>
          </Section>
        )}
        {groups.isError && <FormError message={(groups.error as Error).message} />}
      </Page>
      <CreateGroupSheet open={creating} onClose={() => setCreating(false)} />
    </>
  )
}

function CreateGroupSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', type: 'trip' as GroupType, currency: 'INR' })
  const create = useGroupMutation(null, (body: typeof form) => api<GroupDetail>('/groups/', { method: 'POST', body }))

  function submit(e: FormEvent) {
    e.preventDefault()
    create.mutate(form, {
      onSuccess: (g) => {
        onClose()
        setForm({ name: '', type: 'trip', currency: 'INR' })
        navigate(`/invite?group=${g.id}&new=1`)
      },
    })
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="New group">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field id="group-name" label="Name" placeholder="Goa trip, Flat 4B…" required maxLength={80} autoFocus
          value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-sm font-semibold text-muted">Type</legend>
          <div className="grid grid-cols-3 gap-2">
            {(['trip', 'household', 'other'] as GroupType[]).map((t) => (
              <label key={t} className={`grid min-h-12 cursor-pointer place-items-center rounded-xl border-2 font-semibold ${form.type === t ? 'border-primary bg-surface-2' : 'border-line'}`}>
                <input type="radio" name="group-type" value={t} className="sr-only" checked={form.type === t} onChange={() => setForm({ ...form, type: t })} />
                {TYPE_LABEL[t]}
              </label>
            ))}
          </div>
        </fieldset>
        <Field id="group-currency" label="Currency" maxLength={3} autoCapitalize="characters"
          value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} />
        <FormError message={create.error instanceof ApiError ? create.error.message : undefined} />
        <Button type="submit" disabled={create.isPending}>{create.isPending ? 'Creating…' : 'Create and invite people'}</Button>
      </form>
    </BottomSheet>
  )
}
