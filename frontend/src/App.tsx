import type { ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import { AppShell } from './components/AppShell'
import { Spinner } from './components/ui'
import { Login, Signup } from './pages/Auth'
import { DetailsPage } from './pages/Details'
import { AddExpensePage, EditExpensePage } from './pages/ExpenseForm'
import { GroupPage } from './pages/Group'
import { Home } from './pages/Home'
import { InviteJoinPage } from './pages/InviteJoin'
import { JoinLanding } from './pages/Join'
import { MembersPage } from './pages/Members'
import { PendingPage } from './pages/Pending'
import { Profile } from './pages/Profile'
import { SettleUp } from './pages/SettleUp'

function SignedIn({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Spinner />
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />
  return <AppShell>{children}</AppShell>
}

function SignedOut({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />
  return user ? <Navigate to="/" replace /> : <>{children}</>
}

/** Old per-group invite URL now lives on the Invite & join page. */
function GroupInviteRedirect() {
  const { id } = useParams()
  const { search } = useLocation()
  const params = new URLSearchParams(search)
  params.set('group', id ?? '')
  return <Navigate to={`/invite?${params}`} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<SignedOut><Login /></SignedOut>} />
      <Route path="/signup" element={<SignedOut><Signup /></SignedOut>} />
      <Route path="/" element={<SignedIn><Home /></SignedIn>} />
      <Route path="/add" element={<SignedIn><AddExpensePage /></SignedIn>} />
      <Route path="/details" element={<SignedIn><DetailsPage /></SignedIn>} />
      <Route path="/pending" element={<SignedIn><PendingPage /></SignedIn>} />
      <Route path="/invite" element={<SignedIn><InviteJoinPage /></SignedIn>} />
      <Route path="/join" element={<Navigate to="/invite?tab=join" replace />} />
      <Route path="/join/:code" element={<SignedIn><JoinLanding /></SignedIn>} />
      <Route path="/profile" element={<SignedIn><Profile /></SignedIn>} />
      <Route path="/groups/:id" element={<SignedIn><GroupPage /></SignedIn>} />
      <Route path="/groups/:id/add" element={<GroupAddRedirect />} />
      <Route path="/groups/:id/expenses/:expenseId" element={<SignedIn><EditExpensePage /></SignedIn>} />
      <Route path="/groups/:id/settle" element={<SignedIn><SettleUp /></SignedIn>} />
      <Route path="/groups/:id/invite" element={<GroupInviteRedirect />} />
      <Route path="/groups/:id/members" element={<SignedIn><MembersPage /></SignedIn>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function GroupAddRedirect() {
  const { id } = useParams()
  return <Navigate to={`/add?group=${id}`} replace />
}
