import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import { useGroupMutation, usePending } from '../api/hooks'
import type { GroupRef, Person } from '../api/types'
import { UpiPayButton } from '../components/UpiPay'
import { Avatar, BottomSheet, Button, Empty, FormError, GroupTile, Icon, Page, PageHeader, Section, Segmented, Spinner } from '../components/ui'
import { todayISO } from '../lib/group'
import { formatMoney } from '../lib/money'

type Item = { group: GroupRef; from: Person; to: Person; amount_cents: number }
type Tab = 'pay' | 'receive' | 'others'

export function PendingPage() {
  const pending = usePending()
  const [paying, setPaying] = useState<Item | null>(null)
  const [tab, setTab] = useState<Tab | null>(null)
  // True when the sheet opened because the user went off to their UPI app.
  const [afterUpi, setAfterUpi] = useState(false)
  const record = useGroupMutation(paying?.group.id ?? null, (p: Item) =>
    api(`/groups/${p.group.id}/settlements/`, {
      method: 'POST',
      body: { from_member: p.from.id, to_member: p.to.id, amount: (p.amount_cents / 100).toFixed(2), date: todayISO() },
    }),
  )

  const all: Item[] = (pending.data ?? []).flatMap((g) => g.payments.map((p) => ({ ...p, group: g.group })))
  const toPay = all.filter((p) => p.from.id === p.group.my_membership_id)
  const toGet = all.filter((p) => p.to.id === p.group.my_membership_id)
  const others = all.filter((p) => !toPay.includes(p) && !toGet.includes(p))
  const currency = all[0]?.group.currency ?? 'INR'
  const sum = (list: Item[]) => list.filter((p) => p.group.currency === currency).reduce((s, p) => s + p.amount_cents, 0)
  const saved = (pending.data ?? []).reduce((s, g) => s + g.greedy_count - g.optimal_count, 0)

  const active: Tab = tab ?? (toPay.length ? 'pay' : toGet.length ? 'receive' : 'others')
  const shown = active === 'pay' ? toPay : active === 'receive' ? toGet : others
  const who = (p: Person, me: number) => (p.id === me ? 'You' : p.name)

  return (
    <>
      <PageHeader eyebrow="Across all groups" title="Pending payments" />
      <Page>
        {pending.isPending ? <Spinner /> : all.length === 0 ? (
          <Empty title="All settled up" icon="check">Nobody owes anything in any of your groups. Nice.</Empty>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setTab('pay')} className={`flex flex-col gap-1 rounded-3xl bg-owes-bg p-4 text-left ring-2 transition ${active === 'pay' ? 'ring-owes' : 'ring-transparent'}`}>
                <span className="flex items-center gap-1.5 text-sm font-semibold text-owes"><Icon name="out" size={16} /> You need to pay</span>
                <span className="num font-display text-2xl font-extrabold text-owes md:text-3xl">{formatMoney(sum(toPay), currency)}</span>
                <span className="text-xs font-semibold text-owes/80">{toPay.length} {toPay.length === 1 ? 'payment' : 'payments'}</span>
              </button>
              <button onClick={() => setTab('receive')} className={`flex flex-col gap-1 rounded-3xl bg-owed-bg p-4 text-left ring-2 transition ${active === 'receive' ? 'ring-owed' : 'ring-transparent'}`}>
                <span className="flex items-center gap-1.5 text-sm font-semibold text-owed"><Icon name="in" size={16} /> You'll receive</span>
                <span className="num font-display text-2xl font-extrabold text-owed md:text-3xl">{formatMoney(sum(toGet), currency)}</span>
                <span className="text-xs font-semibold text-owed/80">{toGet.length} {toGet.length === 1 ? 'payment' : 'payments'}</span>
              </button>
            </div>

            <Segmented label="Show" value={active} onChange={setTab}
              options={[
                { value: 'pay', label: <>To pay <Count n={toPay.length} /></> },
                { value: 'receive', label: <>To receive <Count n={toGet.length} /></> },
                { value: 'others', label: <>Others <Count n={others.length} /></> },
              ]} />

            {shown.length === 0 ? (
              <Empty title={active === 'pay' ? "You don't owe anyone" : active === 'receive' ? 'Nobody owes you' : 'Nothing between others'} icon="check" />
            ) : (
              <Section title={active === 'pay' ? 'Pay these' : active === 'receive' ? 'Waiting for these' : 'Between other members'}>
                <ul className="grid gap-3 md:grid-cols-2">
                  {shown.map((p) => {
                    const me = p.group.my_membership_id
                    const mine = active !== 'others'
                    const other = active === 'pay' ? p.to : p.from
                    const canUpi = active === 'pay' && !!p.to.upi_id && p.group.currency === 'INR'
                    return (
                      <li key={`${p.group.id}-${p.from.id}-${p.to.id}`} className="flex flex-col gap-4 rounded-3xl bg-surface p-4">
                        <div className="flex items-start justify-between gap-3">
                          <Link to={`/groups/${p.group.id}`} className="flex min-w-0 items-center gap-2 text-sm font-semibold text-muted hover:text-ink">
                            <GroupTile name={p.group.name} size={22} /> <span className="truncate">{p.group.name}</span>
                          </Link>
                          <span className={`num shrink-0 font-display text-2xl font-extrabold ${active === 'pay' ? 'text-owes' : active === 'receive' ? 'text-owed' : ''}`}>
                            {formatMoney(p.amount_cents, p.group.currency)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          {mine ? <Avatar name={other.name} size={46} /> : (
                            <span className="flex -space-x-3"><Avatar name={p.from.name} size={40} /><Avatar name={p.to.name} size={40} /></span>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold">
                              {active === 'pay' ? `Pay ${p.to.name}` : active === 'receive' ? `${p.from.name} pays you` : `${who(p.from, me)} → ${who(p.to, me)}`}
                            </p>
                            {mine && <p className="truncate text-sm text-muted">@{other.username}</p>}
                          </div>
                        </div>
                        {active === 'pay' && (
                          <UpiPayButton upiId={p.to.upi_id} name={p.to.name} amountCents={p.amount_cents} currency={p.group.currency}
                            note={`Splitter: ${p.group.name}`} onOpened={() => { setPaying(p); setAfterUpi(true) }} />
                        )}
                        <Button variant={active === 'pay' && !canUpi ? 'primary' : 'ghost'} onClick={() => { setPaying(p); setAfterUpi(false) }}>
                          {canUpi ? 'Paid another way? Mark as paid' : active === 'pay' ? 'I paid this' : active === 'receive' ? 'I received this' : 'Mark as paid'}
                        </Button>
                      </li>
                    )
                  })}
                </ul>
              </Section>
            )}

            <p className="px-1 text-sm text-muted">
              Pay by UPI, bank transfer or cash, then mark it here so everyone's balance updates.
              {saved > 0 && ` Smart settling saved ${saved} ${saved === 1 ? 'payment' : 'payments'} compared with the usual method.`}
            </p>
          </>
        )}
      </Page>

      <BottomSheet open={!!paying} onClose={() => { setPaying(null); record.reset() }} title={afterUpi ? 'Did the UPI payment go through?' : 'Record this payment?'}>
        {paying && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-center gap-3 rounded-2xl bg-surface-2 py-5">
              <Avatar name={paying.from.name} size={44} />
              <span className="text-muted"><Icon name="arrow" /></span>
              <Avatar name={paying.to.name} size={44} />
            </div>
            <p className="text-center text-muted">
              <b className="text-ink">{who(paying.from, paying.group.my_membership_id)}</b> paid <b className="text-ink">{who(paying.to, paying.group.my_membership_id)}</b>{' '}
              <b className="num text-ink">{formatMoney(paying.amount_cents, paying.group.currency)}</b> in {paying.group.name}.
              {afterUpi && ' Check your UPI app for the success message first.'}
            </p>
            <FormError message={record.error instanceof ApiError ? record.error.message : undefined} />
            <Button disabled={record.isPending} onClick={() => record.mutate(paying, { onSuccess: () => setPaying(null) })}>
              {record.isPending ? 'Recording…' : 'Yes, it was paid'}
            </Button>
            <Button variant="ghost" onClick={() => setPaying(null)}>{afterUpi ? 'Not yet' : 'Cancel'}</Button>
          </div>
        )}
      </BottomSheet>
    </>
  )
}

function Count({ n }: { n: number }) {
  return <span className="num rounded-full bg-bg px-1.5 text-xs text-muted">{n}</span>
}
