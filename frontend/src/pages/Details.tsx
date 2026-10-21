import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useActivity, useGroups } from '../api/hooks'
import type { ActivityItem } from '../api/types'
import { NetAmount } from '../components/Balance'
import { CategoryTile, Chips, Empty, Icon, List, ListSkeleton, Page, PageHeader, Section, Segmented, Stat } from '../components/ui'
import { category, dayLabel, groupBy, tint } from '../lib/group'
import { formatMoney } from '../lib/money'

type Kind = 'all' | 'expense' | 'payment'

export function DetailsPage() {
  const activity = useActivity()
  const groups = useGroups()
  const [groupId, setGroupId] = useState<number>(0)
  const [kind, setKind] = useState<Kind>('all')
  const [q, setQ] = useState('')

  const items = useMemo(() => {
    const term = q.trim().toLowerCase()
    return (activity.data ?? []).filter((i) =>
      (!groupId || i.group.id === groupId) &&
      (kind === 'all' || i.kind === kind) &&
      (!term || (i.kind === 'expense'
        ? `${i.description} ${i.paid_by.name} ${category(i.category).label}`.toLowerCase().includes(term)
        : `${i.from.name} ${i.to.name}`.toLowerCase().includes(term))),
    )
  }, [activity.data, groupId, kind, q])

  // Summary numbers use the selected group's currency, or the most common one.
  const currency = items[0]?.group.currency ?? groups.data?.[0]?.currency ?? 'INR'
  const expenses = items.filter((i): i is Extract<ActivityItem, { kind: 'expense' }> => i.kind === 'expense' && i.group.currency === currency)
  const spent = expenses.reduce((s, e) => s + e.amount_cents, 0)
  const myShare = expenses.reduce((s, e) => s + e.my_share_cents, 0)
  const byCategory = [...groupBy(expenses, (e) => e.category).entries()]
    .map(([cat, list]) => ({ cat, total: list.reduce((s, e) => s + e.my_share_cents, 0) }))
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total)
  const top = byCategory[0]?.total ?? 1

  const filtered = !!(q || groupId || kind !== 'all')
  const breakdown = byCategory.length > 0 && kind !== 'payment' && (
    <Section title="Where your share went">
      <ul className="flex flex-col gap-3.5 rounded-2xl border border-line bg-surface p-4">
        {byCategory.slice(0, 6).map(({ cat, total }) => {
          const c = category(cat)
          return (
            <li key={cat} className="flex items-center gap-3">
              <CategoryTile value={cat} size={30} />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex justify-between gap-2 text-[13px]">
                  <span className="font-semibold">{c.label}</span>
                  <span className="num font-semibold">{formatMoney(total, currency)}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full" style={{ width: `${Math.max((total / top) * 100, 4)}%`, background: tint(c.hue).color }} />
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </Section>
  )

  return (
    <>
      <PageHeader wide eyebrow="Across all your groups" title="Activity" />
      <Page wide>
        <div className="grid grid-cols-3 gap-2.5 md:gap-3">
          <Stat label="Group spending" value={formatMoney(spent, currency)} />
          <Stat label="Your share" value={formatMoney(myShare, currency)} />
          <Stat label="Expenses" value={String(expenses.length)} />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-3">
              <label className="flex min-h-12 items-center gap-2.5 rounded-xl border border-line bg-surface px-3.5 transition focus-within:border-ink focus-within:ring-4 focus-within:ring-ink/5">
                <span className="text-faint"><Icon name="search" size={18} /></span>
                <input id="details-search" placeholder="Search expenses or people" value={q} onChange={(e) => setQ(e.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-faint" />
                {q && <button type="button" aria-label="Clear search" onClick={() => setQ('')} className="text-faint hover:text-ink"><Icon name="close" size={16} /></button>}
              </label>
              <Chips label="Group" value={groupId} onChange={setGroupId}
                options={[{ value: 0, label: 'All groups' }, ...(groups.data ?? []).map((g) => ({ value: g.id, label: g.name }))]} />
              <Segmented label="Type" value={kind} onChange={setKind}
                options={[{ value: 'all', label: 'Everything' }, { value: 'expense', label: 'Expenses' }, { value: 'payment', label: 'Payments' }]} />
            </div>

            <div className="lg:hidden">{breakdown}</div>

            {activity.isPending ? <ListSkeleton rows={5} /> : items.length === 0 ? (
              <Empty title={filtered ? 'Nothing matches' : 'No activity yet'} icon={filtered ? 'search' : 'activity'}>
                {filtered ? 'Try a different search or filter.' : 'Expenses and payments from all your groups show up here.'}
              </Empty>
            ) : (
              [...groupBy(items, (i) => i.date).entries()].map(([day, list]) => (
                <Section key={day} title={dayLabel(day)}>
                  <List>
                    {list.map((i) => <Row key={`${i.kind}-${i.id}`} item={i} showGroup={!groupId} />)}
                  </List>
                </Section>
              ))
            )}
          </div>
          <div className="hidden lg:sticky lg:top-6 lg:block">{breakdown}</div>
        </div>
      </Page>
    </>
  )
}

function Row({ item, showGroup }: { item: ActivityItem; showGroup: boolean }) {
  const me = item.group.my_membership_id
  const cur = item.group.currency
  if (item.kind === 'payment') {
    const who = (p: { id: number; name: string }) => (p.id === me ? 'You' : p.name)
    return (
      <li className="flex items-center gap-3 px-4 py-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-owed-bg text-owed"><Icon name="check" size={18} strokeWidth={2.5} /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px]"><b className="font-semibold">{who(item.from)}</b> <span className="text-muted">paid</span> <b className="font-semibold">{who(item.to)}</b></span>
          {showGroup && <span className="block truncate text-[13px] text-muted">{item.group.name}</span>}
        </span>
        <span className="num text-[15px] font-semibold">{formatMoney(item.amount_cents, cur)}</span>
      </li>
    )
  }
  const net = (item.paid_by.id === me ? item.amount_cents : 0) - item.my_share_cents
  return (
    <li>
      <Link to={`/groups/${item.group.id}/expenses/${item.id}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface-2/60 active:bg-surface-2">
        <CategoryTile value={item.category} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold">{item.description}</span>
          <span className="num block truncate text-[13px] text-muted">
            {item.paid_by.id === me ? 'You' : item.paid_by.name} paid {formatMoney(item.amount_cents, cur)}{showGroup && ` · ${item.group.name}`}
          </span>
        </span>
        <NetAmount net={net} share={item.my_share_cents} currency={cur} notInvolved="not in it" />
      </Link>
    </li>
  )
}
