export type User = { id: number; username: string; display_name: string; email?: string; upi_id?: string }

export type GroupType = 'trip' | 'household' | 'other'

export type GroupSummary = {
  id: number
  name: string
  type: GroupType
  currency: string
  created_at: string
  my_balance_cents: number
  member_count: number
}

export type Member = {
  id: number
  user: User
  role: 'admin' | 'member'
  joined_at: string
  left_at: string | null
  is_active: boolean
  balance_cents: number
}

export type GroupDetail = Omit<GroupSummary, 'member_count'> & {
  my_membership_id: number
  my_role: 'admin' | 'member'
  members: Member[]
}

export type Expense = {
  id: number
  description: string
  amount_cents: number
  paid_by: number
  splits: { member: number; share_cents: number }[]
  date: string
  category: string
  created_by: string
  created_at: string
}

export type Settlement = {
  id: number
  from_member: number
  to_member: number
  amount_cents: number
  date: string
  created_by: string
  created_at: string
}

export type SettlePlan = {
  payments: { from: number; to: number; amount_cents: number }[]
  optimal_count: number
  greedy_count: number
  expense_count: number
}

export type Invite = {
  id: number
  kind: 'link' | 'direct'
  code: string
  status: string
  expires_at: string | null
  group: { id: number; name: string; type: GroupType; currency: string }
  invited_user: User | null
  created_by: User
}

export type Person = { id: number; name: string; username: string; upi_id: string; is_active: boolean }
export type GroupRef = { id: number; name: string; type: GroupType; currency: string; my_membership_id: number }

export type ActivityItem =
  | {
      kind: 'expense'; id: number; group: GroupRef; description: string; amount_cents: number
      category: string; date: string; created_at: string; paid_by: Person; my_share_cents: number; split_count: number
    }
  | { kind: 'payment'; id: number; group: GroupRef; amount_cents: number; date: string; created_at: string; from: Person; to: Person }

export type PendingGroup = {
  group: GroupRef
  optimal_count: number
  greedy_count: number
  payments: { from: Person; to: Person; amount_cents: number }[]
}

export type DailyItem = {
  id: number
  name: string
  unit: string
  default_quantity: string
  rate_cents: number
  start_date: string
  group: number | null
  group_name: string | null
  user: number
  created_by: string
  created_at: string
}

export type DailyBill = { expense_id: number; amount_cents: number; paid_by: number; up_to_date: boolean }

export type DailyDayStatus = 'default' | 'changed' | 'skipped' | 'future' | 'inactive'

export type DailyMonth = {
  month: string
  total_quantity: string
  total_cents: number
  delivered_days: number
  skipped_days: number
}

export type DailyItemSummary = DailyItem & { this_month: DailyMonth }

export type DailyMonthDetail = DailyMonth & {
  item: DailyItem
  bill: DailyBill | null
  changed_days: number
  days: { date: string; status: DailyDayStatus; quantity: string | null; amount_cents: number }[]
}
