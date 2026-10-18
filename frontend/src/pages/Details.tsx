import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useActivity, useGroups } from '../api/hooks'
import type { ActivityItem } from '../api/types'
import { CategoryTile, Chips, Empty, Icon, Page, PageHeader, Section, Segmented, Spinner } from '../components/ui'
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

  return (
    <>
      <PageHeader eyebrow="All your groups" title="Details" />
      <Page>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Group spending', value: formatMoney(spent, currency) },
            { label: 'Your share', value: formatMoney(myShare, currency) },
            { label: 'Expenses', value: String(expenses.length) },
          ].map((s) => (
            <div key={s.label} className="flex flex-col gap-1 rounded-2xl bg-surface p-3 md:p-4">
              <span className="text-xs font-semibold text-muted">{s.label}</span>
              <span className="num truncate font-display text-lg font-extrabold md:text-2xl">{s.value}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          <label className="flex min-h-12 items-center gap-2 rounded-xl border border-line bg-surface px-4 focus-within:border-primary">
            <span className="text-muted"><Icon name="search" size={18} /></span>
            <input id="details-search" placeholder="Search expenses or people" value={q} onChange={(e) => setQ(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-base outline-none" />
          </label>
          <Chips label="Group" value={groupId} onChange={setGroupId}
            options={[{ value: 0, label: 'All groups' }, ...(groups.data ?? []).map((g) => ({ value: g.id, label: g.name }))]} />
          <Segmented label="Type" value={kind} onChange={setKind}
            options={[{ value: 'all', label: 'Everything' }, { value: 'expense', label: 'Expenses' }, { value: 'payment', label: 'Payments' }]} />
        </div>

        {byCategory.length > 0 && kind !== 'payment' && (
          <Section title="Where your share went">
            <ul className="flex flex-col gap-3 rounded-2xl bg-surface p-4">
              {byCategory.slice(0, 5).map(({ cat, total }) => {
                const c = category(cat)
                return (
                  <li key={cat} className="flex items-center gap-3">
                    <CategoryTile value={cat} size={32} />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-semibold">{c.label}</span>
                        <span className="num font-semibold">{formatMoney(total, currency)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                        <div className="h-full rounded-full" style={{ width: `${Math.max((total / top) * 100, 4)}%`, background: tint(c.hue).color }} />
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </Section>
        )}

        {activity.isPending ? <Spinner /> : items.length === 0 ? (
          <Empty title={q || groupId || kind !== 'all' ? 'Nothing matches' : 'No activity yet'} icon="details">
            {q || groupId || kind !== 'all' ? 'Try a different search or filter.' : 'Expenses and payments from all your groups show up here.'}
          </Empty>
        ) : (
          [...groupBy(items, (i) => i.date).entries()].map(([day, list]) => (
            <Section key={day} title={dayLabel(day)}>
              <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-2xl bg-surface">
                {list.map((i) => <Row key={`${i.kind}-${i.id}`} item={i} showGroup={!groupId} />)}
              </ul>
            </Section>
          ))
        )}
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
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-owed-bg text-owed"><Icon name="check" size={18} /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm"><b>{who(item.from)}</b> paid <b>{who(item.to)}</b></span>
          {showGroup && <span className="block truncate text-xs text-muted">{item.group.name}</span>}
        </span>
        <span className="num font-semibold">{formatMoney(item.amount_cents, cur)}</span>
      </li>
    )
  }
  const net = (item.paid_by.id === me ? item.amount_cents : 0) - item.my_share_cents
  return (
    <li>
      <Link to={`/groups/${item.group.id}/expenses/${item.id}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface-2/50">
        <CategoryTile value={item.category} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{item.description}</span>
          <span className="block truncate text-sm text-muted">
            {item.paid_by.id === me ? 'You' : item.paid_by.name} paid {formatMoney(item.amount_cents, cur)}{showGroup && ` · ${item.group.name}`}
          </span>
        </span>
        <span className="num shrink-0 text-right text-sm">
          {net === 0 ? <span className="text-muted">{item.my_share_cents ? 'even' : 'not in it'}</span> : (
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
