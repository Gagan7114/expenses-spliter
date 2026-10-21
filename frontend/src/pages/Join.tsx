import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api, ApiError } from '../api/client'
import { useGroupMutation } from '../api/hooks'
import type { GroupSummary } from '../api/types'
import { Button, FormError, GroupTile, Page, Spinner, TopBar } from '../components/ui'

/** Landing page for /join/:code (from a shared link or the code form). */
export function JoinLanding() {
  const { code = '' } = useParams()
  const navigate = useNavigate()
  const preview = useQuery({
    queryKey: ['join', code],
    queryFn: () => api<{ group: GroupSummary; member_count: number; already_member: boolean }>(`/join/${code}/`),
    retry: false,
  })
  const join = useGroupMutation(null, () => api<{ group_id: number }>(`/join/${code}/`, { method: 'POST' }))

  return (
    <>
      <TopBar title="Invite" back="/" />
      <Page className="md:max-w-md">
        {preview.isPending ? <Spinner /> : preview.isError ? (
          <div className="flex flex-col gap-4">
            <FormError message={preview.error instanceof ApiError ? preview.error.message : 'This invite could not be opened.'} />
            <Button variant="ghost" onClick={() => navigate('/invite?tab=join')}>Try another code</Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-6 rounded-3xl border border-line bg-surface px-6 py-10 text-center">
            <GroupTile name={preview.data.group.name} size={72} />
            <div className="flex flex-col gap-1">
              <p className="text-[13px] font-medium text-muted">You're invited to</p>
              <h2 className="text-[26px] font-bold tracking-tight">{preview.data.group.name}</h2>
              <p className="text-sm text-muted">{preview.data.member_count} {preview.data.member_count === 1 ? 'person' : 'people'} · {preview.data.group.currency}</p>
            </div>
            {preview.data.already_member ? (
              <Button className="w-full" onClick={() => navigate(`/groups/${preview.data.group.id}`, { replace: true })}>You're already in. Open group</Button>
            ) : (
              <Button className="w-full" disabled={join.isPending}
                onClick={() => join.mutate(undefined, { onSuccess: (r) => navigate(`/groups/${r.group_id}`, { replace: true }) })}>
                {join.isPending ? 'Joining…' : 'Join group'}
              </Button>
            )}
            <FormError message={join.error instanceof ApiError ? join.error.message : undefined} />
          </div>
        )}
      </Page>
    </>
  )
}
