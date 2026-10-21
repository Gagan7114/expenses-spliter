import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import { useExpenses, useGroup, useGroupMutation, useGroups } from '../api/hooks'
import { Avatar, BottomSheet, Button, CategoryTile, Empty, FormError, GroupTile, Icon, IconButton, Page, PageHeader, Spinner, TopBar } from '../components/ui'
import { CATEGORIES, todayISO } from '../lib/group'
import { currencySymbol, equalSplit, formatMoney, parseCents } from '../lib/money'

/** /add: pick a group (remembered in ?group=), then fill the form. */
export function AddExpensePage() {
  const [params, setParams] = useSearchParams()
  const groups = useGroups()
  const [picking, setPicking] = useState(false)
  const list = groups.data ?? []
  const groupId = Number(params.get('group')) || (list.length === 1 ? list[0].id : null)
  const current = list.find((g) => g.id === groupId)

  const choose = (id: number) => { setParams({ group: String(id) }, { replace: true }); setPicking(false) }

  const picker = (
    <ul className="grid gap-2 md:grid-cols-2">
      {list.map((g) => (
        <li key={g.id}>
          <button onClick={() => choose(g.id)}
            className={`flex min-h-16 w-full items-center gap-3 rounded-2xl border bg-surface p-3 text-left transition hover:border-line-strong ${g.id === groupId ? 'border-ink ring-1 ring-ink' : 'border-line'}`}>
            <GroupTile name={g.name} size={40} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{g.name}</span>
              <span className="text-[13px] text-muted">{g.member_count} people · {g.currency}</span>
            </span>
            {g.id === groupId && <span className="grid size-6 place-items-center rounded-full bg-primary text-on-primary"><Icon name="check" size={14} strokeWidth={3} /></span>}
          </button>
        </li>
      ))}
    </ul>
  )

  if (groups.isPending) return <><PageHeader title="Add expense" /><Spinner /></>
  if (!list.length) {
    return (
      <>
        <PageHeader title="Add expense" />
        <Page><Empty title="Create a group first" icon="groups">Expenses belong to a group. Create one on the Groups page or join a friend's.</Empty></Page>
      </>
    )
  }
  if (!current) {
    return (
      <>
        <PageHeader eyebrow="Add expense" title="Which group?" />
        <Page>{picker}</Page>
      </>
    )
  }
  return (
    <>
      <ExpenseForm
        key={current.id}
        groupId={current.id}
        title="Add expense"
        groupSwitch={
          <button type="button" onClick={() => setPicking(true)}
            className="flex min-h-14 items-center gap-3 rounded-2xl border border-line bg-surface px-3 text-left transition hover:border-line-strong">
            <GroupTile name={current.name} size={36} />
            <span className="min-w-0 flex-1">
              <span className="block text-xs text-muted">Adding to</span>
              <span className="block truncate font-semibold">{current.name}</span>
            </span>
            <span className="flex items-center gap-1 rounded-lg bg-surface-2 px-2.5 py-1.5 text-[13px] font-semibold">Change <Icon name="down" size={14} /></span>
          </button>
        }
      />
      <BottomSheet open={picking} onClose={() => setPicking(false)} title="Add to which group?">{picker}</BottomSheet>
    </>
  )
}

/** /groups/:id/expenses/:expenseId */
export function EditExpensePage() {
  const params = useParams()
  return <ExpenseForm groupId={Number(params.id)} expenseId={Number(params.expenseId)} title="Edit expense" />
}

function ExpenseForm({ groupId, expenseId, title, groupSwitch }: { groupId: number; expenseId?: number; title: string; groupSwitch?: ReactNode }) {
  const navigate = useNavigate()
  const group = useGroup(groupId)
  const expenses = useExpenses(groupId)
  const existing = expenseId ? expenses.data?.find((e) => e.id === expenseId) : undefined

  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [paidBy, setPaidBy] = useState<number | null>(null)
  const [participants, setParticipants] = useState<number[]>([])
  const [date, setDate] = useState(todayISO())
  const [category, setCategory] = useState('other')
  const [pickPayer, setPickPayer] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const active = useMemo(() => (group.data?.members ?? []).filter((m) => m.is_active), [group.data])

  // Fill the form once: from the expense being edited, or with sensible defaults.
  useEffect(() => {
    if (loaded || !group.data) return
    if (expenseId) {
      if (!existing) return
      setAmount(String(existing.amount_cents / 100))
      setDescription(existing.description)
      setPaidBy(existing.paid_by)
      setParticipants(existing.splits.map((s) => s.member))
      setDate(existing.date)
      setCategory(existing.category)
    } else {
      setPaidBy(group.data.my_membership_id)
      setParticipants(active.map((m) => m.id))
    }
    setLoaded(true)
  }, [loaded, group.data, existing, expenseId, active])

  const save = useGroupMutation(groupId, (body: object) =>
    expenseId ? api(`/expenses/${expenseId}/`, { method: 'PATCH', body }) : api(`/groups/${groupId}/expenses/`, { method: 'POST', body }),
  )
  const remove = useGroupMutation(groupId, () => api(`/expenses/${expenseId}/`, { method: 'DELETE' }))

  if (!group.data || (expenseId && !loaded)) return <><TopBar title={title} back /><Spinner /></>
  const g = group.data
  const cents = parseCents(amount)
  const shares = cents ? equalSplit(cents, participants) : new Map<number, number>()
  const payer = g.members.find((m) => m.id === paidBy)
  const err = save.error instanceof ApiError ? save.error : undefined
  const ready = !!cents && participants.length > 0 && !!description.trim()

  function submit(e: FormEvent) {
    e.preventDefault()
    save.mutate(
      { description: description.trim(), amount, paid_by: paidBy, participants, date, category },
      { onSuccess: () => navigate(`/groups/${groupId}`, { replace: true }) },
    )
  }
  const toggle = (id: number) => setParticipants((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  return (
    <>
      {expenseId ? (
        <TopBar title={title} back={`/groups/${groupId}`}
          action={
            <IconButton label="Delete expense" icon="trash" tone="danger" onClick={() => setConfirmDelete(true)} />
          } />
      ) : <PageHeader title={title} />}
      <Page>
        <form onSubmit={submit} className="flex flex-col gap-5">
          {groupSwitch}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-[1.1fr_1fr] md:items-start">
            <div className="flex flex-col gap-5">
              <label className="flex flex-col items-center gap-2 rounded-3xl border border-line bg-surface px-4 py-8 focus-within:border-ink">
                <span className="text-[13px] font-medium text-muted">How much?</span>
                <span className="flex items-baseline gap-1">
                  <span className="text-3xl font-semibold text-faint">{currencySymbol(g.currency)}</span>
                  <input
                    id="amount" inputMode="decimal" autoComplete="off" placeholder="0" required autoFocus={!expenseId}
                    value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))}
                    className="num bg-transparent text-[56px] leading-none font-bold tracking-tight outline-none placeholder:text-line-strong"
                    style={{ width: `${Math.max(amount.length, 1) + 0.5}ch` }}
                    aria-invalid={!!err?.field('amount') || (amount !== '' && cents === null)}
                  />
                </span>
                {(err?.field('amount') || (amount !== '' && cents === null)) && (
                  <span className="text-[13px] text-owes">{err?.field('amount') ?? 'Enter an amount like 450 or 99.50'}</span>
                )}
              </label>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="description" className="text-[13px] font-medium text-muted">What was it for?</label>
                <input id="description" required maxLength={120} placeholder="Dinner at Thalassa" value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="min-h-12 rounded-xl border border-line bg-surface px-3.5 text-base outline-none transition placeholder:text-faint focus:border-ink focus:ring-4 focus:ring-ink/5" />
              </div>

              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-[13px] font-medium text-muted">Category</legend>
                <div className="grid grid-cols-5 gap-1.5 md:grid-cols-5">
                  {CATEGORIES.map((c) => (
                    <button type="button" key={c.value} aria-pressed={category === c.value} onClick={() => setCategory(c.value)}
                      className={`flex flex-col items-center gap-1.5 rounded-xl border py-2.5 text-[11px] font-semibold transition ${category === c.value ? 'border-ink bg-surface text-ink ring-1 ring-ink' : 'border-line bg-surface text-muted hover:border-line-strong hover:text-ink'}`}>
                      <CategoryTile value={c.value} size={32} />
                      {c.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setPickPayer(true)} className="flex min-h-14 items-center gap-2.5 rounded-xl border border-line bg-surface px-3 text-left transition hover:border-line-strong">
                  {payer && <Avatar name={payer.user.display_name} size={30} />}
                  <span className="min-w-0">
                    <span className="block text-xs text-muted">Paid by</span>
                    <span className="block truncate font-semibold">{payer ? (payer.id === g.my_membership_id ? 'You' : payer.user.display_name) : 'Choose'}</span>
                  </span>
                </button>
                <label className="flex min-h-14 flex-col justify-center rounded-xl border border-line bg-surface px-3 focus-within:border-ink">
                  <span className="text-xs text-muted">Date</span>
                  <input id="date" type="date" required max={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} className="bg-transparent font-semibold outline-none" />
                </label>
              </div>
            </div>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 flex w-full items-center justify-between text-[13px] font-medium text-muted">
                <span>Split equally between</span>
                <button type="button" className="rounded-lg px-2 py-1 font-semibold text-ink hover:bg-surface-2"
                  onClick={() => setParticipants(participants.length === active.length ? [] : active.map((m) => m.id))}>
                  {participants.length === active.length ? 'Clear' : 'Everyone'}
                </button>
              </legend>
              <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
                {active.map((m) => {
                  const on = participants.includes(m.id)
                  return (
                    <li key={m.id}>
                      <label className="flex min-h-14 cursor-pointer items-center gap-3 px-4 py-2 transition hover:bg-surface-2/60">
                        <input type="checkbox" checked={on} onChange={() => toggle(m.id)} className="size-[18px] rounded accent-[var(--primary)]" />
                        <Avatar name={m.user.display_name} size={32} />
                        <span className="min-w-0 flex-1 truncate font-medium">{m.id === g.my_membership_id ? 'You' : m.user.display_name}</span>
                        <span className={`num text-sm ${on ? 'font-semibold' : 'text-faint'}`}>{on && cents ? formatMoney(shares.get(m.id) ?? 0, g.currency) : '—'}</span>
                      </label>
                    </li>
                  )
                })}
              </ul>
              {cents && participants.length > 0 ? (
                <p className="num px-1 text-[13px] text-muted">
                  {participants.length} {participants.length === 1 ? 'person' : 'people'} · about {formatMoney(Math.round(cents / participants.length), g.currency)} each
                </p>
              ) : null}
              {err?.field('participants') && <p className="text-sm text-owes">{err.field('participants')}</p>}
            </fieldset>
          </div>

          <FormError message={err && !err.field('amount') && !err.field('participants') ? err.message : undefined} />
          {/* Opaque bar so the sticky button never shows the form through it on phones. */}
          <div className="sticky z-10 -mx-4 border-t border-line bg-bg/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:flex md:justify-end md:border-0 md:bg-transparent md:p-0"
            style={{ bottom: 'var(--nav-h)' }}>
            <Button type="submit" variant="accent" className="w-full md:w-auto md:px-10" disabled={save.isPending || !ready}>
              {save.isPending ? 'Saving…' : expenseId ? 'Save changes' : cents ? `Add ${formatMoney(cents, g.currency)}` : 'Add expense'}
            </Button>
          </div>
        </form>
      </Page>

      <BottomSheet open={pickPayer} onClose={() => setPickPayer(false)} title="Who paid?">
        <ul className="flex flex-col gap-1">
          {active.map((m) => (
            <li key={m.id}>
              <button onClick={() => { setPaidBy(m.id); setPickPayer(false) }}
                className={`flex min-h-14 w-full items-center gap-3 rounded-xl px-3 text-left transition hover:bg-surface-2 ${paidBy === m.id ? 'bg-surface-2' : ''}`}>
                <Avatar name={m.user.display_name} size={36} />
                <span className="flex-1 font-semibold">{m.id === g.my_membership_id ? 'You' : m.user.display_name}</span>
                {paidBy === m.id && <span className="grid size-6 place-items-center rounded-full bg-primary text-on-primary"><Icon name="check" size={14} strokeWidth={3} /></span>}
              </button>
            </li>
          ))}
        </ul>
      </BottomSheet>

      <BottomSheet open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete this expense?">
        <p className="mb-5 text-[15px] text-muted">Balances will be recalculated for everyone in the group. This can't be undone.</p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Keep it</Button>
          <Button variant="danger" disabled={remove.isPending}
            onClick={() => remove.mutate(undefined, { onSuccess: () => navigate(`/groups/${groupId}`, { replace: true }) })}>
            {remove.isPending ? 'Deleting…' : 'Delete expense'}
          </Button>
        </div>
      </BottomSheet>
    </>
  )
}
