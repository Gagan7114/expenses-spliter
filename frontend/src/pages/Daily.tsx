import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import { useDailyItems, useDailyMonth, useDailyMutation, useGroup, useGroups } from '../api/hooks'
import type { DailyBill, DailyDayStatus, DailyItem, DailyMonthDetail } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { Avatar, BottomSheet, Button, buttonClass, Empty, Field, FormError, GroupTile, Icon, IconButton, ListSkeleton, Page, PageHeader, Section, Select, Spinner, TopBar } from '../components/ui'
import { formatMoney, parseCents } from '../lib/money'

const pad = (n: number) => String(n).padStart(2, '0')
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
const thisMonth = () => today().slice(0, 7)

function shiftMonth(month: string, by: number) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + by, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

const monthLabel = (month: string) => new Date(`${month}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
const dayLabel = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })

/** '3.00' -> '3', '2.50' -> '2.5' */
const qty = (q: string | number) => String(Number(q))

// ---------- List ----------

export function DailyListPage() {
  const items = useDailyItems()
  const [creating, setCreating] = useState(false)
  const list = items.data ?? []
  return (
    <>
      <PageHeader wide eyebrow="Track what comes every day" title="Daily items"
        action={list.length > 0 && <Button variant="ghost" size="sm" onClick={() => setCreating(true)}><Icon name="plus" size={16} /> New item</Button>} />
      <Page wide>
        {items.isPending ? <ListSkeleton rows={2} /> : list.length === 0 ? (
          <Empty title="Nothing tracked yet" icon="milk">
            Add milk (or the newspaper, water cans…) with its daily quantity and price. Every day counts automatically — just mark the days it didn't come or you took extra.
            <div className="mt-4 flex justify-center"><Button onClick={() => setCreating(true)}>Add milk</Button></div>
          </Empty>
        ) : (
          <Section title={monthLabel(thisMonth())}>
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {list.map((it) => (
                <li key={it.id}>
                  <Link to={`/daily/${it.id}`} className="flex h-full flex-col gap-4 rounded-2xl border border-line bg-surface p-4 transition hover:border-line-strong">
                    <span className="flex items-center gap-3">
                      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-surface-2 text-ink"><Icon name="milk" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold">{it.name}</span>
                        <span className="num block text-[13px] text-muted">{qty(it.default_quantity)} {it.unit}/day · {formatMoney(it.rate_cents)}/{it.unit}</span>
                      </span>
                      <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-muted">{it.group_name ? it.group_name : 'Personal'}</span>
                    </span>
                    <span className="flex items-end justify-between border-t border-line pt-3">
                      <span className="num text-[13px] text-muted">
                        {qty(it.this_month.total_quantity)} {it.unit} · {it.this_month.delivered_days} days
                        {it.this_month.skipped_days > 0 && ` · ${it.this_month.skipped_days} skipped`}
                      </span>
                      <span className="num text-xl font-bold tracking-tight">{formatMoney(it.this_month.total_cents)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </Page>
      <ItemSheet open={creating} onClose={() => setCreating(false)} />
    </>
  )
}

// ---------- Create / edit ----------

function ItemSheet({ open, onClose, item, defaultGroup, stay }: { open: boolean; onClose: () => void; item?: DailyItem; defaultGroup?: number; stay?: boolean }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const groups = useGroups()
  const [form, setForm] = useState(() => ({
    group: item?.group ?? defaultGroup ?? null as number | null,
    name: item?.name ?? 'Milk',
    unit: item?.unit ?? 'L',
    default_quantity: item ? qty(item.default_quantity) : '3',
    rate: item ? String(item.rate_cents / 100) : '75',
    start_date: item?.start_date ?? `${thisMonth()}-01`,
  }))
  const save = useDailyMutation((body: typeof form) =>
    api<DailyItem>(item ? `/daily-items/${item.id}/` : '/daily-items/', { method: item ? 'PATCH' : 'POST', body }))
  const remove = useDailyMutation(() => api(`/daily-items/${item!.id}/`, { method: 'DELETE' }))
  const err = (save.error ?? remove.error) as ApiError | null

  function submit(e: FormEvent) {
    e.preventDefault()
    save.mutate(form, {
      onSuccess: (saved) => { onClose(); if (!item && !stay) navigate(`/daily/${saved.id}`) },
    })
  }

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value })
  return (
    <BottomSheet open={open} onClose={onClose} title={item ? `Edit ${item.name}` : 'New daily item'}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field id="daily-name" label="Name" required maxLength={60} value={form.name} onChange={set('name')} error={err?.field('name')} />
        <div className="grid grid-cols-2 gap-3">
          <Field id="daily-qty" label="Every day" required inputMode="decimal" value={form.default_quantity}
            onChange={set('default_quantity')} error={err?.field('default_quantity')} />
          <Field id="daily-unit" label="Unit" required maxLength={12} value={form.unit} onChange={set('unit')} error={err?.field('unit')} />
        </div>
        <Field id="daily-rate" label={`Price per ${form.unit || 'unit'} (₹)`} required inputMode="decimal" value={form.rate}
          onChange={set('rate')} error={err?.field('rate') ?? (form.rate && parseCents(form.rate) === null ? 'Enter a valid amount.' : undefined)}
          hint={item && 'Changing the price recalculates every month, including past ones.'} />
        <Field id="daily-start" label="Tracking since" type="date" required value={form.start_date} onChange={set('start_date')}
          error={err?.field('start_date')} hint="Days before this aren't counted." />
        <Select id="daily-group" label="Share with" value={form.group ?? ''} onChange={(e) => setForm({ ...form, group: e.target.value ? Number(e.target.value) : null })}
          error={err?.field('group')} hint="Everyone in the group can mark days, and the monthly bill can be split in the group.">
          <option value="">Just me (personal)</option>
          {(groups.data ?? []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </Select>
        <FormError message={err && !['name', 'unit', 'default_quantity', 'rate', 'start_date', 'group'].some((f) => err.field(f)) ? err.message : undefined} />
        <Button type="submit" className="mt-1" disabled={save.isPending}>{save.isPending ? 'Saving…' : item ? 'Save changes' : 'Start tracking'}</Button>
        {item && item.user === user?.id && (
          <Button type="button" variant="danger" disabled={remove.isPending}
            onClick={() => confirm(`Delete ${item.name} and all its days?`) && remove.mutate(undefined, { onSuccess: () => { onClose(); if (!stay) navigate('/daily') } })}>
            Delete item
          </Button>
        )}
      </form>
    </BottomSheet>
  )
}

// ---------- Month calendar ----------

const CELL: Record<DailyDayStatus, string> = {
  default: 'border border-line bg-surface text-ink hover:border-line-strong',
  changed: 'bg-accent text-on-accent',
  skipped: 'bg-owes-bg text-owes',
  future: 'border border-dashed border-line text-faint',
  inactive: 'text-faint/60',
}

export function DailyItemPage() {
  const id = Number(useParams().id)
  const data = useDailyMonth(id, thisMonth())
  const [editing, setEditing] = useState(false)
  const item = data.data?.item
  return (
    <>
      <TopBar title={item?.name ?? 'Daily item'} back="/daily"
        action={item && <IconButton label="Edit item" icon="settings" onClick={() => setEditing(true)} />} />
      <Page><DailyMonthView itemId={id} /></Page>
      {item && editing && <ItemSheet open item={item} onClose={() => setEditing(false)} />}
    </>
  )
}

/** The month calendar for one item: totals, group bill, and tap-a-day editing. */
export function DailyMonthView({ itemId, inGroup }: { itemId: number; inGroup?: boolean }) {
  const [month, setMonth] = useState(thisMonth)
  const data = useDailyMonth(itemId, month)
  const [day, setDay] = useState<DailyMonthDetail['days'][number] | null>(null)
  const [billing, setBilling] = useState(false)
  const m = data.data
  const isCurrent = month >= thisMonth()

  // Monday-first grid: blank cells before the 1st.
  const lead = m ? (new Date(`${m.days[0].date}T00:00:00`).getDay() + 6) % 7 : 0

  return (
    <>
      <div className="flex items-center justify-between rounded-2xl border border-line bg-surface p-1.5">
        <IconButton label="Previous month" icon="back" onClick={() => setMonth(shiftMonth(month, -1))} />
        <h2 className="text-[17px] font-semibold tracking-tight">{monthLabel(month)}</h2>
        <IconButton label="Next month" icon="chevron" disabled={isCurrent} onClick={() => setMonth(shiftMonth(month, 1))} />
      </div>

      {data.isPending ? <Spinner /> : data.isError || !m ? <FormError message={(data.error as ApiError)?.message ?? 'Could not load this item.'} /> : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Total" value={formatMoney(m.total_cents)} strong />
            <Stat label="Quantity" value={`${qty(m.total_quantity)} ${m.item.unit}`} />
            <Stat label="Skipped" value={`${m.skipped_days} ${m.skipped_days === 1 ? 'day' : 'days'}`} />
          </div>

          {m.item.group && m.item.group_name && (
            <GroupBillCard groupId={m.item.group} groupName={m.item.group_name} month={month} total={m.total_cents} bill={m.bill} onAdd={() => setBilling(true)} inGroup={inGroup} />
          )}

          <div className="rounded-2xl border border-line bg-surface p-3 md:p-4">
            <div className="mb-2 grid grid-cols-7 gap-1.5 text-center text-[11px] font-semibold text-faint">
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i}>{d}</span>)}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: lead }, (_, i) => <span key={`b${i}`} />)}
              {m.days.map((d) => {
                const editable = d.status !== 'future' && d.status !== 'inactive'
                return (
                  <button key={d.date} disabled={!editable} onClick={() => setDay(d)}
                    aria-label={`${dayLabel(d.date)}: ${d.status === 'skipped' ? 'skipped' : d.quantity ? `${qty(d.quantity)} ${m.item.unit}` : 'not counted'}`}
                    className={`flex aspect-square flex-col items-center justify-center rounded-xl text-sm transition enabled:active:scale-95 ${CELL[d.status]} ${d.date === today() ? 'outline-2 outline-offset-2 outline-ink' : ''}`}>
                    <span className="font-semibold leading-none">{Number(d.date.slice(8))}</span>
                    <span className="num mt-0.5 text-[10px] leading-none">
                      {d.status === 'skipped' ? '✕' : d.quantity !== null ? qty(d.quantity) : ''}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
          <p className="flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs text-muted">
            <Legend className="bg-surface border border-line-strong" label={`${qty(m.item.default_quantity)} ${m.item.unit} (default)`} />
            <Legend className="bg-accent" label="Changed" />
            <Legend className="bg-owes-bg" label="Skipped" />
          </p>
          <p className="px-1 text-[13px] text-muted">
            Every day counts as {qty(m.item.default_quantity)} {m.item.unit} at {formatMoney(m.item.rate_cents)}/{m.item.unit}. Tap a day to skip it or change the quantity.
          </p>
        </>
      )}
      {m && day && <DaySheet key={day.date} item={m.item} day={day} onClose={() => setDay(null)} />}
      {m && billing && m.item.group && <BillSheet item={m.item} groupId={m.item.group} month={month} total={m.total_cents} bill={m.bill} onClose={() => setBilling(false)} />}
    </>
  )
}

/** The group page's Milk tab: every daily item shared with this group, with its full calendar. */
export function GroupDailyTab({ groupId }: { groupId: number }) {
  const items = useDailyItems()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<DailyItem | null>(null)
  const mine = (items.data ?? []).filter((it) => it.group === groupId)
  return (
    <>
      {items.isPending ? <Spinner /> : mine.length === 0 ? (
        <Empty title="No milk tracked here yet" icon="milk">
          Track the group's daily milk: every day counts automatically, anyone can mark skipped or extra days, and the month's bill is split in the group.
          <div className="mt-4 flex justify-center"><Button onClick={() => setCreating(true)}>Add milk</Button></div>
        </Empty>
      ) : (
        <>
          {mine.map((it) => (
            <section key={it.id} className="flex flex-col gap-4">
              <div className="flex items-center gap-3 px-1">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2"><Icon name="milk" size={20} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[17px] font-semibold">{it.name}</span>
                  <span className="num block text-[13px] text-muted">{qty(it.default_quantity)} {it.unit}/day · {formatMoney(it.rate_cents)}/{it.unit} · added by {it.created_by}</span>
                </span>
                <IconButton label={`Edit ${it.name}`} icon="settings" onClick={() => setEditing(it)} />
              </div>
              <DailyMonthView itemId={it.id} inGroup />
            </section>
          ))}
          <Button variant="ghost" onClick={() => setCreating(true)}>Track another item</Button>
        </>
      )}
      {creating && <ItemSheet open defaultGroup={groupId} stay onClose={() => setCreating(false)} />}
      {editing && <ItemSheet key={editing.id} open item={editing} stay onClose={() => setEditing(null)} />}
    </>
  )
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex min-w-0 flex-col gap-0.5 rounded-2xl p-3.5 ${strong ? 'bg-hero text-hero-ink' : 'border border-line bg-surface'}`}>
      <span className={`truncate text-xs font-medium ${strong ? 'text-hero-muted' : 'text-muted'}`}>{label}</span>
      <span className={`num truncate text-lg font-bold tracking-tight md:text-xl ${strong ? 'text-accent' : ''}`}>{value}</span>
    </div>
  )
}

function Legend({ className, label }: { className: string; label: string }) {
  return <span className="flex items-center gap-1.5"><span className={`size-3 rounded ${className}`} />{label}</span>
}

// ---------- One day ----------

function DaySheet({ item, day, onClose }: { item: DailyItem; day: DailyMonthDetail['days'][number]; onClose: () => void }) {
  const def = Number(item.default_quantity)
  const [value, setValue] = useState(Number(day.quantity ?? def))
  const save = useDailyMutation((quantity: number) =>
    api(`/daily-items/${item.id}/days/${day.date}/`, { method: 'PUT', body: { quantity: quantity.toFixed(2) } }))
  const err = save.error as ApiError | null
  const step = 0.5
  const apply = (q: number) => save.mutate(q, { onSuccess: onClose })
  const presets = [...new Set([def - 1, def - step, def + step, def + 1, def + 2].filter((q) => q > 0))]

  return (
    <BottomSheet open onClose={onClose} title={dayLabel(day.date)}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between rounded-2xl bg-surface-2 p-3">
          <button aria-label="Less" onClick={() => setValue((v) => Math.max(0, v - step))} className="grid size-12 place-items-center rounded-xl border border-line bg-surface transition active:scale-95"><Icon name="minus" /></button>
          <div className="text-center">
            <p className="num text-4xl font-bold tracking-tight">{value === 0 ? 'Skipped' : `${qty(value)} ${item.unit}`}</p>
            <p className="num text-sm text-muted">{formatMoney(Math.round(value * item.rate_cents))}</p>
          </div>
          <button aria-label="More" onClick={() => setValue((v) => v + step)} className="grid size-12 place-items-center rounded-xl border border-line bg-surface transition active:scale-95"><Icon name="plus" /></button>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {presets.map((q) => (
            <button key={q} onClick={() => setValue(q)}
              className={`num min-h-9 rounded-full border px-3.5 text-sm font-semibold transition ${value === q ? 'border-primary bg-primary text-on-primary' : 'border-line bg-surface text-muted hover:border-line-strong hover:text-ink'}`}>
              {qty(q)} {item.unit}
            </button>
          ))}
        </div>
        <FormError message={err?.message} />
        <Button disabled={save.isPending} onClick={() => apply(value)}>{save.isPending ? 'Saving…' : 'Save'}</Button>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="danger" disabled={save.isPending || day.status === 'skipped'} onClick={() => apply(0)}>Didn't come</Button>
          <Button variant="ghost" disabled={save.isPending || day.status === 'default'} onClick={() => apply(def)}>Reset to {qty(def)} {item.unit}</Button>
        </div>
      </div>
    </BottomSheet>
  )
}

// ---------- Group bill ----------

function GroupBillCard({ groupId, groupName, month, total, bill, onAdd, inGroup }: { groupId: number; groupName: string; month: string; total: number; bill: DailyBill | null; onAdd: () => void; inGroup?: boolean }) {
  const name = monthLabel(month).split(' ')[0]
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center gap-3">
        <GroupTile name={groupName} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{inGroup ? 'Monthly bill' : `Shared with ${groupName}`}</p>
          <p className="text-[13px] text-muted">
            {!bill ? `${name}'s bill isn't in the group yet.`
              : bill.up_to_date ? `${name}'s bill of ${formatMoney(bill.amount_cents)} is in the group.`
              : `Added as ${formatMoney(bill.amount_cents)}, but the total is now ${formatMoney(total)}.`}
          </p>
        </div>
        {bill?.up_to_date && <span className="grid size-8 place-items-center rounded-full bg-owed-bg text-owed"><Icon name="check" size={18} /></span>}
      </div>
      <div className="flex gap-2">
        {(!bill || !bill.up_to_date) && (
          <Button variant="accent" className="flex-1" disabled={total <= 0} onClick={onAdd}>
            {bill ? `Update to ${formatMoney(total)}` : `Add ${formatMoney(total)} to group`}
          </Button>
        )}
        {bill && (
          <Link to={`/groups/${groupId}/expenses/${bill.expense_id}`} className={`${buttonClass('ghost')} flex-1`}>
            View expense
          </Link>
        )}
      </div>
    </div>
  )
}

function BillSheet({ item, groupId, month, total, bill, onClose }: { item: DailyItem; groupId: number; month: string; total: number; bill: DailyBill | null; onClose: () => void }) {
  const group = useGroup(groupId)
  const qc = useQueryClient()
  const active = (group.data?.members ?? []).filter((mb) => mb.is_active)
  const [paidBy, setPaidBy] = useState<number | null>(bill?.paid_by ?? null)
  const [people, setPeople] = useState<number[] | null>(null)
  const payer = paidBy ?? group.data?.my_membership_id ?? null
  const chosen = people ?? active.map((mb) => mb.id)
  const save = useMutation({
    mutationFn: () => api<DailyBill>(`/daily-items/${item.id}/bill/`, { method: 'POST', body: { month, paid_by: payer, participants: chosen } }),
    // The bill changes balances everywhere, so refresh everything.
    onSuccess: () => { qc.invalidateQueries(); onClose() },
  })
  const err = save.error as ApiError | null
  const toggle = (id: number) => setPeople(chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id])
  const share = chosen.length ? Math.floor(total / chosen.length) : 0

  return (
    <BottomSheet open onClose={onClose} title={`${item.name} – ${monthLabel(month)}`}>
      {group.isPending ? <Spinner /> : (
        <div className="flex flex-col gap-4">
          <p className="num rounded-2xl bg-surface-2 py-5 text-center text-4xl font-bold tracking-tight">{formatMoney(total)}</p>
          <Section title="Who paid the milkman?">
            <div className="flex flex-wrap gap-2">
              {active.map((mb) => (
                <button key={mb.id} onClick={() => setPaidBy(mb.id)}
                  className={`flex min-h-10 items-center gap-2 rounded-full border py-1 pr-4 pl-1 text-sm font-semibold transition ${payer === mb.id ? 'border-primary bg-primary text-on-primary' : 'border-line bg-surface text-muted hover:border-line-strong'}`}>
                  <Avatar name={mb.user.display_name} size={30} />{mb.id === group.data?.my_membership_id ? 'You' : mb.user.display_name}
                </button>
              ))}
            </div>
          </Section>
          <Section title={`Split equally between${chosen.length ? ` · ${formatMoney(share)} each` : ''}`}>
            <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line">
              {active.map((mb) => (
                <li key={mb.id}>
                  <label className="flex min-h-12 cursor-pointer items-center gap-3 px-3 transition hover:bg-surface-2/60">
                    <input type="checkbox" className="size-[18px] accent-[var(--primary)]" checked={chosen.includes(mb.id)} onChange={() => toggle(mb.id)} />
                    <Avatar name={mb.user.display_name} size={32} />
                    <span className="flex-1 font-semibold">{mb.user.display_name}</span>
                  </label>
                </li>
              ))}
            </ul>
          </Section>
          <FormError message={err?.message} />
          <Button disabled={save.isPending || !payer || !chosen.length} onClick={() => save.mutate()}>
            {save.isPending ? 'Saving…' : bill ? 'Update group expense' : 'Add to group'}
          </Button>
        </div>
      )}
    </BottomSheet>
  )
}
