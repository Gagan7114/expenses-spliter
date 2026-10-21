import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import { useGroupMutation, useGroups, useInbox } from '../api/hooks'
import type { GroupDetail, GroupType } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { Avatar, BottomSheet, Button, buttonClass, Empty, Field, FormError, GroupTile, Icon, List, ListSkeleton, Page, PageHeader, Section } from '../components/ui'
import { formatMoney } from '../lib/money'

export const TYPE_LABEL: Record<GroupType, string> = { trip: 'Trip', household: 'Home', other: 'Group' }
const TYPE_ICON: Record<GroupType, string> = { trip: 'travel', household: 'rent', other: 'groups' }

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

  const net = owed + owe
  const hero = (
    <section className="relative flex flex-col gap-5 overflow-hidden rounded-3xl bg-hero p-5 text-hero-ink md:p-6">
      <div className="pointer-events-none absolute -top-24 -right-24 size-64 rounded-full bg-accent/10 blur-3xl" />
      <div className="relative">
        <p className="text-[13px] font-medium text-hero-muted">{net === 0 ? 'Overall' : net > 0 ? 'Overall, you are owed' : 'Overall, you owe'}</p>
        <p className={`num mt-1 text-[40px] leading-none font-bold tracking-tight ${net > 0 ? 'text-accent' : net < 0 ? 'text-[#ff9b8c]' : ''}`}>
          {net === 0 ? 'All square' : formatMoney(net, currency)}
        </p>
      </div>
      <div className="relative grid grid-cols-2 gap-2">
        <Link to="/pending" className="flex flex-col gap-0.5 rounded-2xl bg-hero-2 px-3.5 py-3 transition hover:bg-white/10">
          <span className="flex items-center gap-1 text-xs font-medium text-hero-muted"><Icon name="in" size={14} /> You'll get back</span>
          <span className="num text-lg font-semibold text-[#7ee2b4]">{formatMoney(owed, currency)}</span>
        </Link>
        <Link to="/pending" className="flex flex-col gap-0.5 rounded-2xl bg-hero-2 px-3.5 py-3 transition hover:bg-white/10">
          <span className="flex items-center gap-1 text-xs font-medium text-hero-muted"><Icon name="out" size={14} /> You owe</span>
          <span className="num text-lg font-semibold text-[#ff9b8c]">{formatMoney(owe, currency)}</span>
        </Link>
      </div>
    </section>
  )

  const daily = (
    <Link to="/daily" className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 transition hover:border-line-strong">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2"><Icon name="milk" size={20} /></span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">Milk & daily items</span>
        <span className="block text-[13px] text-muted">Mark skipped or extra days, see the month's bill</span>
      </span>
      <span className="text-faint"><Icon name="chevron" size={18} /></span>
    </Link>
  )

  return (
    <>
      <PageHeader
        wide
        eyebrow={`${greeting()}, ${user?.display_name.split(' ')[0]}`}
        title="Your groups"
        action={
          <>
            <span className="hidden md:block"><Button variant="ghost" size="sm" onClick={() => setCreating(true)}><Icon name="plus" size={16} /> New group</Button></span>
            <Link to="/profile" aria-label="Profile" className="md:hidden"><Avatar name={user?.display_name ?? '?'} size={40} /></Link>
          </>
        }
      />
      <Page wide>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
          <div className="flex flex-col gap-6 lg:order-2 lg:sticky lg:top-6">
            {list.length > 0 && hero}
            <div className="hidden lg:block">{daily}</div>
          </div>

          <div className="flex flex-col gap-6 lg:order-1">
            {!!inbox.data?.length && (
              <Link to="/invite?tab=join" className="flex items-center gap-3 rounded-2xl border border-accent bg-accent/15 p-3.5 transition hover:bg-accent/25">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-on-accent"><Icon name="bell" size={19} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{inbox.data.length === 1 ? `${inbox.data[0].created_by.display_name} invited you to ${inbox.data[0].group.name}` : `${inbox.data.length} group invites waiting`}</span>
                  <span className="text-[13px] text-muted">Tap to accept or decline</span>
                </span>
                <Icon name="chevron" size={18} />
              </Link>
            )}

            {groups.isPending ? <ListSkeleton rows={3} /> : list.length === 0 ? (
              <Empty title="No groups yet" icon="groups">
                Create one for your flat or next trip, or join a friend's group with their invite code.
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <Button onClick={() => setCreating(true)}>Create group</Button>
                  <Link to="/invite?tab=join" className={buttonClass('ghost')}>Join with code</Link>
                </div>
              </Empty>
            ) : (
              <Section title={`${list.length} ${list.length === 1 ? 'group' : 'groups'}`}
                action={<button onClick={() => setCreating(true)} className="flex items-center gap-1 text-[13px] font-semibold text-ink md:hidden"><Icon name="plus" size={15} /> New</button>}>
                <List>
                  {list.map((g) => (
                    <li key={g.id}>
                      <Link to={`/groups/${g.id}`} className="flex items-center gap-3.5 px-4 py-3.5 transition hover:bg-surface-2/60 active:bg-surface-2">
                        <GroupTile name={g.name} size={44} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-semibold">{g.name}</span>
                          <span className="block truncate text-[13px] text-muted">{TYPE_LABEL[g.type]} · {g.member_count} {g.member_count === 1 ? 'person' : 'people'}</span>
                        </span>
                        <GroupBalance cents={g.my_balance_cents} currency={g.currency} />
                        <span className="hidden text-faint sm:block"><Icon name="chevron" size={18} /></span>
                      </Link>
                    </li>
                  ))}
                  <li>
                    <button onClick={() => setCreating(true)} className="flex w-full items-center gap-3.5 px-4 py-3 text-left text-[15px] font-semibold text-muted transition hover:bg-surface-2/60 hover:text-ink">
                      <span className="grid size-11 place-items-center rounded-[13px] border border-dashed border-line-strong"><Icon name="plus" size={18} /></span>
                      New group
                    </button>
                  </li>
                </List>
              </Section>
            )}
            {groups.isError && <FormError message={(groups.error as Error).message} />}
            <div className="lg:hidden">{daily}</div>
          </div>
        </div>
      </Page>
      <CreateGroupSheet open={creating} onClose={() => setCreating(false)} />
    </>
  )
}

/** Right side of a group row: what you're owed / owe there. */
function GroupBalance({ cents, currency }: { cents: number; currency: string }) {
  if (cents === 0) return <span className="text-[13px] font-medium text-faint">settled up</span>
  const owed = cents > 0
  return (
    <span className="num flex shrink-0 flex-col items-end leading-tight">
      <span className={`text-[11px] font-medium ${owed ? 'text-owed' : 'text-owes'}`}>{owed ? "you're owed" : 'you owe'}</span>
      <span className={`text-[15px] font-semibold ${owed ? 'text-owed' : 'text-owes'}`}>{formatMoney(cents, currency)}</span>
    </span>
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
          <legend className="mb-1.5 text-[13px] font-medium text-muted">Type</legend>
          <div className="grid grid-cols-3 gap-2">
            {(['trip', 'household', 'other'] as GroupType[]).map((t) => (
              <label key={t} className={`flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition ${form.type === t ? 'border-ink bg-surface-2 ring-1 ring-ink' : 'border-line text-muted hover:border-line-strong'}`}>
                <input type="radio" name="group-type" value={t} className="sr-only" checked={form.type === t} onChange={() => setForm({ ...form, type: t })} />
                <Icon name={TYPE_ICON[t]} size={17} /> {TYPE_LABEL[t]}
              </label>
            ))}
          </div>
        </fieldset>
        <Field id="group-currency" label="Currency" maxLength={3} autoCapitalize="characters"
          value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} />
        <FormError message={create.error instanceof ApiError ? create.error.message : undefined} />
        <Button type="submit" className="mt-1" disabled={create.isPending}>{create.isPending ? 'Creating…' : 'Create and invite people'}</Button>
      </form>
    </BottomSheet>
  )
}
