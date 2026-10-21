import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useExpenses, useGroup, useSettlements } from '../api/hooks'
import type { Expense, Settlement } from '../api/types'
import { BalancePill, NetAmount } from '../components/Balance'
import { Avatar, AvatarStack, CategoryTile, Empty, FormError, Icon, List, ListSkeleton, Page, Section, Segmented, Spinner, TopBar } from '../components/ui'
import { TYPE_LABEL } from './Home'
import { dayLabel, memberMap, nameOf } from '../lib/group'
import { GroupDailyTab } from './Daily'
import { formatMoney } from '../lib/money'

type Row = { kind: 'expense'; item: Expense } | { kind: 'settlement'; item: Settlement }

export function GroupPage() {
  const id = Number(useParams().id)
  const group = useGroup(id)
  const expenses = useExpenses(id)
  const settlements = useSettlements(id)
  const [tab, setTab] = useState<'activity' | 'balances' | 'daily'>('activity')

  if (group.isError) {
    return (
      <>
        <TopBar title="Group" back="/" wide />
        <Page wide><FormError message="This group doesn't exist or you're not a member." /></Page>
      </>
    )
  }
  if (!group.data) return <><TopBar title="" back="/" wide /><Spinner /></>

  const g = group.data
  const members = memberMap(g)
  const me = g.my_membership_id
  const cur = g.currency
  const total = (expenses.data ?? []).reduce((s, e) => s + e.amount_cents, 0)
  const unsettled = g.members.some((m) => m.balance_cents !== 0)

  const rows: Row[] = [
    ...(expenses.data ?? []).map((item) => ({ kind: 'expense' as const, item })),
    ...(settlements.data ?? []).map((item) => ({ kind: 'settlement' as const, item })),
  ].sort((a, b) => b.item.date.localeCompare(a.item.date) || b.item.created_at.localeCompare(a.item.created_at))
  const byDay = new Map<string, Row[]>()
  for (const r of rows) byDay.set(r.item.date, [...(byDay.get(r.item.date) ?? []), r])

  const activeMembers = g.members.filter((m) => m.is_active)
  const balances = (
    <List>
      {g.members.filter((m) => m.is_active || m.balance_cents !== 0)
        .sort((a, b) => b.balance_cents - a.balance_cents)
        .map((m) => (
          <li key={m.id} className="flex items-center gap-3 px-4 py-3">
            <Avatar name={m.user.display_name} size={36} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold">{m.id === me ? 'You' : m.user.display_name}</span>
              <span className="block truncate text-[13px] text-muted">@{m.user.username}{!m.is_active && ' · left'}</span>
            </span>
            <BalancePill cents={m.balance_cents} currency={cur} you={false} />
          </li>
        ))}
    </List>
  )

  return (
    <>
      <TopBar
        wide
        title={g.name}
        subtitle={`${TYPE_LABEL[g.type]} · ${activeMembers.length} ${activeMembers.length === 1 ? 'person' : 'people'}`}
        back="/"
        action={
          <Link to={`/groups/${id}/members`} aria-label="Members and settings" title="Members and settings" className="grid size-10 place-items-center rounded-full transition hover:bg-surface-2">
            <Icon name="settings" size={20} />
          </Link>
        }
      />
      <Page wide>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
          <div className="flex flex-col gap-6 lg:order-2 lg:sticky lg:top-22">
            <section className="relative flex flex-col gap-5 overflow-hidden rounded-3xl bg-hero p-5 text-hero-ink md:p-6">
              <div className="pointer-events-none absolute -top-24 -right-24 size-64 rounded-full bg-accent/10 blur-3xl" />
              <div className="relative flex items-start justify-between gap-3">
                <div>
                  <p className="text-[13px] font-medium text-hero-muted">
                    {g.my_balance_cents === 0 ? 'Your balance' : g.my_balance_cents > 0 ? "You're owed" : 'You owe'}
                  </p>
                  <p className={`num mt-1 text-[40px] leading-none font-bold tracking-tight ${g.my_balance_cents > 0 ? 'text-accent' : g.my_balance_cents < 0 ? 'text-[#ff9b8c]' : ''}`}>
                    {g.my_balance_cents === 0 ? 'Settled' : formatMoney(g.my_balance_cents, cur)}
                  </p>
                </div>
                <AvatarStack names={activeMembers.map((m) => m.user.display_name)} size={28} />
              </div>
              <p className="relative num text-[13px] text-hero-muted">Group spent <span className="font-semibold text-hero-ink">{formatMoney(total, cur)}</span> across {expenses.data?.length ?? 0} {expenses.data?.length === 1 ? 'expense' : 'expenses'}</p>
              <div className="relative flex gap-2">
                <Link to={`/groups/${id}/settle`}
                  className={`flex min-h-11 flex-1 items-center justify-center rounded-xl text-[15px] font-semibold transition active:scale-[.98] ${unsettled ? 'bg-accent text-on-accent hover:brightness-95' : 'bg-hero-2 text-hero-muted'}`}>
                  Settle up
                </Link>
                <Link to={`/invite?group=${id}`} className="flex min-h-11 items-center gap-2 rounded-xl bg-hero-2 px-4 text-[15px] font-semibold transition hover:bg-white/10">
                  <Icon name="share" size={17} /> Invite
                </Link>
              </div>
            </section>
            <div className="hidden lg:block">
              <Section title="Balances">{balances}</Section>
            </div>
          </div>

          <div className="flex flex-col gap-5 lg:order-1">
            <Segmented label="View" value={tab} onChange={setTab}
              options={[{ value: 'activity', label: 'Expenses' }, { value: 'balances', label: 'Balances' }, { value: 'daily', label: 'Milk' }]} />

            {tab === 'daily' ? <GroupDailyTab groupId={id} /> : tab === 'balances' ? balances
              : expenses.isPending ? <ListSkeleton /> : rows.length === 0 ? (
              <Empty title="No expenses yet" icon="other">Tap <b>+</b> to add one when someone pays for something the group shares.</Empty>
            ) : (
              [...byDay.entries()].map(([day, items]) => (
                <Section key={day} title={dayLabel(day)}>
                  <List>
                    {items.map((r) => r.kind === 'expense'
                      ? <ExpenseRow key={`e${r.item.id}`} e={r.item} me={me} members={members} cur={cur} groupId={id} />
                      : <SettlementRow key={`s${r.item.id}`} s={r.item} me={me} members={members} cur={cur} />)}
                  </List>
                </Section>
              ))
            )}
          </div>
        </div>
      </Page>
    </>
  )
}

function ExpenseRow({ e, me, members, cur, groupId }: { e: Expense; me: number; members: ReturnType<typeof memberMap>; cur: string; groupId: number }) {
  const myShare = e.splits.find((s) => s.member === me)?.share_cents ?? 0
  const paidByMe = e.paid_by === me
  const net = (paidByMe ? e.amount_cents : 0) - myShare
  return (
    <li>
      <Link to={`/groups/${groupId}/expenses/${e.id}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface-2/60 active:bg-surface-2">
        <CategoryTile value={e.category} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold">{e.description}</span>
          <span className="num block truncate text-[13px] text-muted">{nameOf(members, e.paid_by, me)} paid {formatMoney(e.amount_cents, cur)}</span>
        </span>
        <NetAmount net={net} share={myShare} currency={cur} />
      </Link>
    </li>
  )
}

function SettlementRow({ s, me, members, cur }: { s: Settlement; me: number; members: ReturnType<typeof memberMap>; cur: string }) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-owed-bg text-owed"><Icon name="check" size={18} strokeWidth={2.5} /></span>
      <span className="min-w-0 flex-1 text-[15px]">
        <span className="font-semibold">{nameOf(members, s.from_member, me)}</span> <span className="text-muted">paid</span> <span className="font-semibold">{nameOf(members, s.to_member, me)}</span>
      </span>
      <span className="num text-[15px] font-semibold">{formatMoney(s.amount_cents, cur)}</span>
    </li>
  )
}
