import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import { useGroup, useGroupMutation, useSettlePlan } from '../api/hooks'
import { Avatar, BottomSheet, Button, Empty, FormError, Icon, Page, Spinner, TopBar } from '../components/ui'
import { memberMap, nameOf, todayISO } from '../lib/group'
import { formatMoney } from '../lib/money'

type Payment = { from: number; to: number; amount_cents: number }

export function SettleUp() {
  const id = Number(useParams().id)
  const group = useGroup(id)
  const plan = useSettlePlan(id)
  const [paying, setPaying] = useState<Payment | null>(null)
  const record = useGroupMutation(id, (p: Payment) =>
    api(`/groups/${id}/settlements/`, {
      method: 'POST',
      body: { from_member: p.from, to_member: p.to, amount: (p.amount_cents / 100).toFixed(2), date: todayISO() },
    }),
  )

  if (!group.data || !plan.data) return <><TopBar title="Settle up" back={`/groups/${id}`} /><Spinner /></>
  const g = group.data
  const members = memberMap(g)
  const me = g.my_membership_id
  const p = plan.data
  // Payments involving me first.
  const payments = [...p.payments].sort((a, b) => Number(b.from === me || b.to === me) - Number(a.from === me || a.to === me))

  return (
    <>
      <TopBar title="Settle up" back={`/groups/${id}`} />
      <Page>
        {payments.length === 0 ? (
          <Empty title="Everyone is settled up">Nobody owes anything in {g.name} right now.</Empty>
        ) : (
          <>
            <section className="rounded-3xl bg-primary px-5 py-4 text-on-primary">
              <p className="font-display text-2xl font-bold">
                {p.optimal_count === 1 ? '1 payment settles everyone' : `${p.optimal_count} payments settle everyone`}
              </p>
              <p className="text-sm opacity-80">
                Worked out from {p.expense_count} {p.expense_count === 1 ? 'expense' : 'expenses'}
                {p.greedy_count > p.optimal_count && ` · ${p.greedy_count - p.optimal_count} fewer than the usual method`}
              </p>
            </section>
            <ul className="flex flex-col gap-2">
              {payments.map((pay) => {
                const mine = pay.from === me || pay.to === me
                return (
                  <li key={`${pay.from}-${pay.to}`} className={`flex flex-col gap-3 rounded-2xl bg-surface p-4 ${mine ? 'ring-2 ring-accent/70' : ''}`}>
                    <div className="flex items-center gap-2">
                      <Avatar name={members.get(pay.from)?.user.display_name ?? '?'} size={36} />
                      <span className="text-muted"><Icon name="arrow" size={18} /></span>
                      <Avatar name={members.get(pay.to)?.user.display_name ?? '?'} size={36} />
                      <span className="num ml-auto font-display text-xl font-bold">{formatMoney(pay.amount_cents, g.currency)}</span>
                    </div>
                    <p>
                      <span className="font-semibold">{nameOf(members, pay.from, me)}</span> {pay.from === me ? 'pay' : 'pays'}{' '}
                      <span className="font-semibold">{nameOf(members, pay.to, me)}</span>
                    </p>
                    <Button variant={mine ? 'primary' : 'ghost'} onClick={() => setPaying(pay)}>Mark as paid</Button>
                  </li>
                )
              })}
            </ul>
            <p className="px-1 text-sm text-muted">Pay by UPI, bank transfer or cash, then mark it here so everyone's balance updates.</p>
          </>
        )}
      </Page>

      <BottomSheet open={!!paying} onClose={() => setPaying(null)} title="Record this payment?">
        {paying && (
          <div className="flex flex-col gap-4">
            <p className="text-muted">
              <span className="font-semibold text-ink">{nameOf(members, paying.from, me)}</span> paid{' '}
              <span className="font-semibold text-ink">{nameOf(members, paying.to, me)}</span>{' '}
              <span className="num font-semibold text-ink">{formatMoney(paying.amount_cents, g.currency)}</span>.
              It shows in the group's activity for everyone.
            </p>
            <FormError message={record.error instanceof ApiError ? record.error.message : undefined} />
            <Button disabled={record.isPending} onClick={() => record.mutate(paying, { onSuccess: () => setPaying(null) })}>
              {record.isPending ? 'Recording…' : 'Yes, it was paid'}
            </Button>
            <Button variant="ghost" onClick={() => setPaying(null)}>Cancel</Button>
          </div>
        )}
      </BottomSheet>
    </>
  )
}
