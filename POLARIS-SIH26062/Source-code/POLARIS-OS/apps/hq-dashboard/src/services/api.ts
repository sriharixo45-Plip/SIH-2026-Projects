export class ApiError extends Error {
  readonly status: number
  readonly endpoint: string
  readonly technicalDetails: string
  readonly requestId?: string
  constructor(message: string, status: number, endpoint: string, technicalDetails = '', requestId?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.endpoint = endpoint
    this.technicalDetails = technicalDetails
    this.requestId = requestId
  }
}

const API_BASE = '/api'
const TOKEN_KEY = 'polaris_access_token'
const REFRESH_KEY = 'polaris_refresh_token'
const REQUEST_TIMEOUT_MS = 15_000
let authToken: string | null = typeof window === 'undefined' ? null : window.sessionStorage.getItem(TOKEN_KEY)
let refreshToken: string | null = typeof window === 'undefined' ? null : window.sessionStorage.getItem(REFRESH_KEY)

export function getAuthToken(): string | null { return authToken }
export function setAuthToken(token: string | null) {
  authToken = token
  if (typeof window === 'undefined') return
  if (token) window.sessionStorage.setItem(TOKEN_KEY, token)
  else window.sessionStorage.removeItem(TOKEN_KEY)
  if (!token) setRefreshToken(null)
}

export function setRefreshToken(token: string | null) {
  refreshToken = token
  if (typeof window === 'undefined') return
  if (token) window.sessionStorage.setItem(REFRESH_KEY, token)
  else window.sessionStorage.removeItem(REFRESH_KEY)
}

async function renewAccessToken(): Promise<boolean> {
  if (!refreshToken) return false
  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: refreshToken }) })
    if (!response.ok) return false
    const tokens = await response.json() as { access_token?: string; refresh_token?: string }
    if (!tokens.access_token || !tokens.refresh_token) return false
    authToken = tokens.access_token
    refreshToken = tokens.refresh_token
    window.sessionStorage.setItem(TOKEN_KEY, authToken)
    window.sessionStorage.setItem(REFRESH_KEY, refreshToken)
    return true
  } catch { return false }
}

function serviceName(path: string): string {
  const endpoint = path.toLowerCase()
  if (endpoint.includes('personnel')) return 'Personnel data'
  if (endpoint.includes('transport')) return 'Transport data'
  if (endpoint.includes('cargo')) return 'Cargo data'
  if (endpoint.includes('inventory') || endpoint.includes('item-catalog')) return 'Inventory data'
  if (endpoint.includes('station')) return 'Station data'
  if (endpoint.includes('expedition')) return 'Expedition data'
  if (endpoint.includes('incident')) return 'Incident data'
  if (endpoint.includes('recommendation')) return 'Recommendation data'
  if (endpoint.includes('approval')) return 'Approval data'
  if (endpoint.includes('sync')) return 'Sync data'
  if (endpoint.includes('audit')) return 'Audit data'
  if (endpoint.includes('user') || endpoint.includes('role')) return 'Account data'
  return 'Operational data'
}

function friendlyError(status: number, path: string): string {
  if (status === 401) return 'Your session has expired. Sign in again.'
  if (status === 403) return 'You are not authorized to access this operational module.'
  if (status === 404) return 'The requested operational record could not be found.'
  if (status === 409) return 'This operation conflicts with the current operational state.'
  if (status === 422) return 'The submitted operational data is invalid.'
  if (status === 429) return 'Too many requests. Please retry shortly.'
  if (status === 500) return `${serviceName(path)} is currently unavailable.`
  if ([502, 503, 504].includes(status)) return 'Operations service is temporarily unreachable.'
  return 'The operational request could not be completed. Please retry shortly.'
}

async function requestJson<T>(path: string, init?: RequestInit, retried = false): Promise<T> {
  const headers = new Headers(init?.headers)
  if (authToken && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${authToken}`)
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, { ...init, headers, signal: controller.signal })
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === 'AbortError'
    throw new ApiError(timedOut ? 'The request timed out. Check the HQ API connection and retry.' : 'HQ API could not be reached.', 0, path, error instanceof Error ? error.message : '')
  } finally {
    window.clearTimeout(timer)
  }
  if (!response.ok) {
    if (response.status === 401 && !retried && path !== '/auth/login' && path !== '/auth/refresh' && await renewAccessToken()) return requestJson<T>(path, init, true)
    const body = await response.text().catch(() => '')
    if (response.status === 401) {
      setAuthToken(null)
      window.dispatchEvent(new CustomEvent('polaris:unauthorized'))
    }
    throw new ApiError(friendlyError(response.status, path), response.status, path, body, response.headers.get('x-request-id') || response.headers.get('request-id') || undefined)
  }
  if (response.status === 204) return undefined as T
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) return (await response.text()) as T
  try { return (await response.json()) as T }
  catch (error) { throw new ApiError('HQ API returned an unreadable response.', response.status, path, error instanceof Error ? error.message : 'Invalid JSON response.', response.headers.get('x-request-id') || undefined) }
}

export function apiGet<T>(path: string): Promise<T> { return requestJson<T>(path, { method: 'GET' }) }
export function apiPost<T>(path: string, body?: Record<string, unknown>): Promise<T> {
  return requestJson<T>(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
}
export function apiPatch<T>(path: string, body: Record<string, unknown>): Promise<T> {
  return requestJson<T>(path, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}
export function apiDelete<T>(path: string): Promise<T> { return requestJson<T>(path, { method: 'DELETE' }) }
