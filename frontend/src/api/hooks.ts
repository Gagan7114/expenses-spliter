import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { ActivityItem, Expense, GroupDetail, GroupSummary, Invite, PendingGroup, SettlePlan, Settlement } from './types'

// Polling keeps everyone in a group in sync until WebSockets (Django Channels) are added.
const LIVE = { refetchInterval: 10_000 }

export const keys = {
  groups: ['groups'] as const,
  group: (id: number) => ['group', id] as const,
  expenses: (id: number) => ['group', id, 'expenses'] as const,
  settlements: (id: number) => ['group', id, 'settlements'] as const,
  settle: (id: number) => ['group', id, 'settle'] as const,
  inbox: ['invites'] as const,
  activity: ['activity'] as const,
  pending: ['pending'] as const,
}

export const useGroups = () => useQuery({ queryKey: keys.groups, queryFn: () => api<GroupSummary[]>('/groups/'), ...LIVE })
export const useGroup = (id: number) => useQuery({ queryKey: keys.group(id), queryFn: () => api<GroupDetail>(`/groups/${id}/`), ...LIVE })
export const useExpenses = (id: number) => useQuery({ queryKey: keys.expenses(id), queryFn: () => api<Expense[]>(`/groups/${id}/expenses/`), ...LIVE })
export const useSettlements = (id: number) => useQuery({ queryKey: keys.settlements(id), queryFn: () => api<Settlement[]>(`/groups/${id}/settlements/`), ...LIVE })
export const useSettlePlan = (id: number) => useQuery({ queryKey: keys.settle(id), queryFn: () => api<SettlePlan>(`/groups/${id}/settle/`), ...LIVE })
export const useActivity = () => useQuery({ queryKey: keys.activity, queryFn: () => api<ActivityItem[]>('/activity/'), ...LIVE })
export const usePending = () => useQuery({ queryKey: keys.pending, queryFn: () => api<PendingGroup[]>('/pending/'), ...LIVE })
export const useInbox = () => useQuery({ queryKey: keys.inbox, queryFn: () => api<Invite[]>('/invites/'), ...LIVE })

/** A mutation that refreshes everything about one group (and the home list) when it succeeds. */
export function useGroupMutation<TVars, TResult = unknown>(groupId: number | null, fn: (vars: TVars) => Promise<TResult>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.groups })
      qc.invalidateQueries({ queryKey: keys.inbox })
      qc.invalidateQueries({ queryKey: keys.activity })
      qc.invalidateQueries({ queryKey: keys.pending })
      if (groupId) qc.invalidateQueries({ queryKey: ['group', groupId] })
    },
  })
}
