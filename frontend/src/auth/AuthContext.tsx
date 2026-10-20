import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, onSignedOut, tokens } from '../api/client'
import type { User } from '../api/types'

type AuthResponse = { access: string; refresh: string; user: User }

type AuthState = {
  user: User | null
  loading: boolean
  login: (login: string, password: string) => Promise<void>
  register: (data: { username: string; email: string; password: string; display_name: string }) => Promise<void>
  resetPassword: (uid: string, token: string, password: string) => Promise<void>
  logout: () => void
  setUser: (u: User) => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(!!tokens.access)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!tokens.access) return
    api<User>('/me/')
      .then(setUser)
      .catch(() => tokens.clear())
      .finally(() => setLoading(false))
  }, [])

  const logout = useCallback(() => {
    tokens.clear()
    setUser(null)
    queryClient.clear()
  }, [queryClient])

  useEffect(() => {
    const handler = () => logout()
    onSignedOut.addEventListener('signedout', handler)
    return () => onSignedOut.removeEventListener('signedout', handler)
  }, [logout])

  const finish = (r: AuthResponse) => {
    tokens.set(r.access, r.refresh)
    setUser(r.user)
  }

  const value: AuthState = {
    user,
    loading,
    login: async (login, password) => finish(await api<AuthResponse>('/auth/login/', { method: 'POST', body: { login, password } })),
    register: async (data) => finish(await api<AuthResponse>('/auth/register/', { method: 'POST', body: data })),
    resetPassword: async (uid, token, password) =>
      finish(await api<AuthResponse>('/auth/password-reset/confirm/', { method: 'POST', body: { uid, token, password } })),
    logout,
    setUser,
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
