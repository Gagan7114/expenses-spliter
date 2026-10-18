const ACCESS = 'tab.access'
const REFRESH = 'tab.refresh'
const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || '/api'
).replace(/\/+$/, '')

function read(key: string) {
  try { return localStorage.getItem(key) } catch { return null }
}
function write(key: string, value: string | null) {
  try { value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value) } catch { /* private mode */ }
}

export const tokens = {
  get access() { return read(ACCESS) },
  get refresh() { return read(REFRESH) },
  set(access: string, refresh: string) { write(ACCESS, access); write(REFRESH, refresh) },
  clear() { write(ACCESS, null); write(REFRESH, null) },
}

export class ApiError extends Error {
  status: number
  data: unknown
  constructor(status: number, data: unknown) {
    super(firstMessage(data) ?? `Request failed (${status})`)
    this.status = status
    this.data = data
  }
  /** Message for one form field, if the server sent one. */
  field(name: string): string | undefined {
    const v = (this.data as Record<string, unknown> | null)?.[name]
    return Array.isArray(v) ? String(v[0]) : typeof v === 'string' ? v : undefined
  }
}

function firstMessage(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined
  const d = data as Record<string, unknown>
  if (typeof d.detail === 'string') return d.detail
  for (const v of Object.values(d)) {
    if (Array.isArray(v) && v.length) return String(v[0])
    if (typeof v === 'string') return v
    const nested = firstMessage(v)
    if (nested) return nested
  }
}

let refreshing: Promise<boolean> | null = null

async function refreshAccess(): Promise<boolean> {
  const refresh = tokens.refresh
  if (!refresh) return false
  refreshing ??= fetch(`${API_BASE_URL}/auth/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh }),
  })
    .then(async (r) => {
      if (!r.ok) return false
      const data = await r.json()
      tokens.set(data.access, data.refresh ?? refresh)
      return true
    })
    .catch(() => false)
    .finally(() => { refreshing = null })
  return refreshing
}

export const onSignedOut = new EventTarget()

export async function api<T = unknown>(path: string, options: { method?: string; body?: unknown } = {}, retry = true): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  if (tokens.access) headers.Authorization = `Bearer ${tokens.access}`

  let res: Response
  try {
    const endpoint = `${API_BASE_URL}/${path.replace(/^\/+/, '')}`

    res = await fetch(endpoint, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  } catch {
    throw new ApiError(0, { detail: "Can't reach the server. Check your connection and try again." })
  }

  if (res.status === 401 && retry && tokens.refresh && (await refreshAccess())) {
    return api<T>(path, options, false)
  }
  if (res.status === 401 && tokens.access) {
    tokens.clear()
    onSignedOut.dispatchEvent(new Event('signedout'))
  }
  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(res.status, data)
  return data as T
}
