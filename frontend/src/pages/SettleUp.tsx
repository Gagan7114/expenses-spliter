import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import { useGroup, useGroupMutation, useSettlePlan } from '../api/hooks'
import { useAuth } from '../auth/AuthContext'
import { UpiPayButton } from '../components/UpiPay'
import { Avatar, BottomSheet, Button, Empty, FormError, Icon, Page, Spinner, TopBar } from '../components/ui'
import { memberMap, nameOf, todayISO } from '../lib/group'
import { formatMoney } from '../lib/money'

type Payment = { from: number; to: number; amount_cents: number }

export function SettleUp() {
  const id = Number(useParams().id)
  const group = useGroup(id)
  const plan = useSettlePlan(id)
  const { user } = useAuth()
  const [paying, setPaying] = useState<Payment | null>(null)
  // True when the sheet opened because the user went off to their UPI app.
  const [afterUpi, setAfterUpi] = useState(false)
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
          <Empty title="Everyone is settled up" icon="check">Nobody owes anything in {g.name} right now.</Empty>
        ) : (
          <>
            <section className="relative overflow-hidden rounded-3xl bg-hero px-5 py-5 text-hero-ink md:px-6">
              <div className="pointer-events-none absolute -top-20 -right-20 size-56 rounded-full bg-accent/10 blur-3xl" />
              <p className="relative flex items-center gap-2 text-[13px] font-medium text-accent"><Icon name="sparkle" size={15} /> Smart settle</p>
              <p className="relative mt-1 text-2xl font-bold tracking-tight">
                {p.optimal_count === 1 ? '1 payment settles everyone' : `${p.optimal_count} payments settle everyone`}
              </p>
              <p className="relative mt-1 text-[13px] text-hero-muted">
                Worked out from {p.expense_count} {p.expense_count === 1 ? 'expense' : 'expenses'}
                {p.greedy_count > p.optimal_count && ` · ${p.greedy_count - p.optimal_count} fewer than the usual method`}
              </p>
            </section>
            <ul className="flex flex-col gap-2">
              {payments.map((pay) => {
                const mine = pay.from === me || pay.to === me
                const payee = members.get(pay.to)?.user
                const canUpi = pay.from === me && !!payee?.upi_id && g.currency === 'INR'
                return (
                  <li key={`${pay.from}-${pay.to}`} className={`flex flex-col gap-3 rounded-2xl border bg-surface p-4 ${mine ? 'border-ink ring-1 ring-ink' : 'border-line'}`}>
                    <div className="flex items-center gap-2">
                      <Avatar name={members.get(pay.from)?.user.display_name ?? '?'} size={36} />
                      <span className="text-faint"><Icon name="arrow" size={18} /></span>
                      <Avatar name={members.get(pay.to)?.user.display_name ?? '?'} size={36} />
                      {mine && <span className="ml-1 rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-on-accent">You</span>}
                      <span className="num ml-auto text-xl font-bold tracking-tight">{formatMoney(pay.amount_cents, g.currency)}</span>
                    </div>
                    <p className="text-[15px]">
                      <span className="font-semibold">{nameOf(members, pay.from, me)}</span> {pay.from === me ? 'pay' : 'pays'}{' '}
                      <span className="font-semibold">{nameOf(members, pay.to, me)}</span>
                    </p>
                    {pay.from === me && payee && (
                      <UpiPayButton upiId={payee.upi_id} name={payee.display_name} amountCents={pay.amount_cents} currency={g.currency}
                        note={`Splitter: ${g.name}`} onOpened={() => { setPaying(pay); setAfterUpi(true) }} />
                    )}
                    {pay.to === me && !user?.upi_id && g.currency === 'INR' && (
                      <p className="rounded-xl bg-surface-2 px-3.5 py-3 text-[13px] text-muted">
                        <Link to="/profile" className="font-semibold text-ink underline underline-offset-2">Add your UPI ID</Link> so {nameOf(members, pay.from, me)} can pay you in one tap.
                      </p>
                    )}
                    <Button variant={mine && !canUpi ? 'primary' : 'ghost'} onClick={() => { setPaying(pay); setAfterUpi(false) }}>
                      {canUpi ? 'Paid another way? Mark as paid' : 'Mark as paid'}
                    </Button>
                  </li>
                )
              })}
            </ul>
            <p className="px-1 text-[13px] text-muted">Pay by UPI, bank transfer or cash, then mark it here so everyone's balance updates.</p>
          </>
        )}
      </Page>

      <BottomSheet open={!!paying} onClose={() => setPaying(null)} title={afterUpi ? 'Did the UPI payment go through?' : 'Record this payment?'}>
        {paying && (
          <div className="flex flex-col gap-4">
            <p className="text-[15px] text-muted">
              <span className="font-semibold text-ink">{nameOf(members, paying.from, me)}</span> paid{' '}
              <span className="font-semibold text-ink">{nameOf(members, paying.to, me)}</span>{' '}
              <span className="num font-semibold text-ink">{formatMoney(paying.amount_cents, g.currency)}</span>.
              {afterUpi && ' Check your UPI app for the success message first.'} It shows in the group's activity for everyone.
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
