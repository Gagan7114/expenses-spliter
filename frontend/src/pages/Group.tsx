import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useExpenses, useGroup, useSettlements } from '../api/hooks'
import type { Expense, Settlement } from '../api/types'
import { BalancePill } from '../components/Balance'
import { Avatar, CategoryTile, Empty, FormError, Icon, Page, Segmented, Spinner, TopBar } from '../components/ui'
import { dayLabel, memberMap, nameOf } from '../lib/group'
import { formatMoney } from '../lib/money'

type Row = { kind: 'expense'; item: Expense } | { kind: 'settlement'; item: Settlement }

export function GroupPage() {
  const id = Number(useParams().id)
  const group = useGroup(id)
  const expenses = useExpenses(id)
  const settlements = useSettlements(id)
  const [tab, setTab] = useState<'activity' | 'balances'>('activity')

  if (group.isError) {
    return (
      <>
        <TopBar title="Group" back="/" />
        <Page><FormError message="This group doesn't exist or you're not a member." /></Page>
      </>
    )
  }
  if (!group.data) return <><TopBar title="" back="/" /><Spinner /></>

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

  return (
    <>
      <TopBar
        title={g.name}
        back="/"
        action={
          <Link to={`/groups/${id}/members`} aria-label="Members and settings" className="grid size-11 place-items-center rounded-full active:bg-surface-2">
            <Icon name="settings" />
          </Link>
        }
      />
      <Page>
        <section className="flex flex-col gap-4 rounded-3xl bg-surface p-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-muted">
                {g.my_balance_cents === 0 ? 'Your balance' : g.my_balance_cents > 0 ? "You're owed" : 'You owe'}
              </p>
              <p className={`num font-display text-4xl font-extrabold ${g.my_balance_cents > 0 ? 'text-owed' : g.my_balance_cents < 0 ? 'text-owes' : ''}`}>
                {g.my_balance_cents === 0 ? 'Settled' : formatMoney(g.my_balance_cents, cur)}
              </p>
            </div>
            <p className="num text-right text-sm text-muted">Group spent<br /><span className="font-semibold text-ink">{formatMoney(total, cur)}</span></p>
          </div>
          <div className="flex gap-2">
            <Link to={`/groups/${id}/settle`}
              className={`grid min-h-12 flex-1 place-items-center rounded-2xl font-semibold ${unsettled ? 'bg-primary text-on-primary' : 'bg-surface-2 text-muted'}`}>
              Settle up
            </Link>
            <Link to={`/invite?group=${id}`} className="flex min-h-12 items-center gap-2 rounded-2xl bg-surface-2 px-4 font-semibold">
              <Icon name="share" size={18} /> Invite
            </Link>
          </div>
        </section>

        <Segmented label="View" value={tab} onChange={setTab}
          options={[{ value: 'activity', label: 'Expenses' }, { value: 'balances', label: 'Balances' }]} />

        {tab === 'balances' ? (
          <ul className="flex flex-col divide-y divide-line rounded-2xl bg-surface">
            {g.members.filter((m) => m.is_active || m.balance_cents !== 0)
              .sort((a, b) => b.balance_cents - a.balance_cents)
              .map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                  <Avatar name={m.user.display_name} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{m.id === me ? 'You' : m.user.display_name}</span>
                    <span className="block truncate text-sm text-muted">@{m.user.username}{!m.is_active && ' · left'}</span>
                  </span>
                  <BalancePill cents={m.balance_cents} currency={cur} you={false} />
                </li>
              ))}
          </ul>
        ) : expenses.isPending ? <Spinner /> : rows.length === 0 ? (
          <Empty title="No expenses yet" icon="other">Tap <b>+</b> to add one when someone pays for something the group shares.</Empty>
        ) : (
          [...byDay.entries()].map(([day, items]) => (
            <section key={day} className="flex flex-col gap-1.5">
              <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted">{dayLabel(day)}</h2>
              <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-2xl bg-surface">
                {items.map((r) => r.kind === 'expense'
                  ? <ExpenseRow key={`e${r.item.id}`} e={r.item} me={me} members={members} cur={cur} groupId={id} />
                  : <SettlementRow key={`s${r.item.id}`} s={r.item} me={me} members={members} cur={cur} />)}
              </ul>
            </section>
          ))
        )}
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
      <Link to={`/groups/${groupId}/expenses/${e.id}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface-2/50 active:bg-surface-2">
        <CategoryTile value={e.category} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{e.description}</span>
          <span className="block truncate text-sm text-muted">{nameOf(members, e.paid_by, me)} paid {formatMoney(e.amount_cents, cur)}</span>
        </span>
        <span className="num shrink-0 text-right text-sm">
          {net === 0 ? <span className="text-muted">{myShare ? 'even' : 'not involved'}</span> : (
            <>
              <span className={`block text-xs ${net > 0 ? 'text-owed' : 'text-owes'}`}>{net > 0 ? 'you lent' : 'you borrowed'}</span>
              <span className={`font-semibold ${net > 0 ? 'text-owed' : 'text-owes'}`}>{formatMoney(net, cur)}</span>
            </>
          )}
        </span>
      </Link>
    </li>
  )
}

function SettlementRow({ s, me, members, cur }: { s: Settlement; me: number; members: ReturnType<typeof memberMap>; cur: string }) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-owed-bg text-owed"><Icon name="check" size={18} /></span>
      <span className="min-w-0 flex-1 text-sm">
        <span className="font-semibold">{nameOf(members, s.from_member, me)}</span> paid <span className="font-semibold">{nameOf(members, s.to_member, me)}</span>
      </span>
      <span className="num font-semibold">{formatMoney(s.amount_cents, cur)}</span>
    </li>
  )
}
