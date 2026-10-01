import { clearSession, getToken } from '../lib/authStorage'
import { notifyAuthInvalid } from './authEvents'

const baseURL = (process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.20:8000').replace(/\/$/, '')

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const fromJsonBody = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (Array.isArray(value)) {
    const parts = value.map(fromJsonBody).filter(Boolean) as string[]
    return parts.length ? parts.join(' ') : null
  }
  if (!value || typeof value !== 'object') return null

  const obj = value as Record<string, unknown>
  for (const key of ['detail', 'message', 'error', 'non_field_errors']) {
    const found = fromJsonBody(obj[key])
    if (found) return found
  }

  const fieldMessages: string[] = []
  for (const [key, val] of Object.entries(obj)) {
    const found = fromJsonBody(val)
    if (found) fieldMessages.push(`${key}: ${found}`)
  }
  return fieldMessages.length ? fieldMessages.join('\n') : null
}

export const apiErrorMessage = (err: unknown) => {
  if (err instanceof ApiError) {
    if (err.status === 403) {
      return 'You do not have permission to perform this action.'
    }
    const raw = err.message.trim()
    if (!raw || raw.startsWith('<')) return `Request failed (${err.status})`
    if (raw.startsWith('{') || raw.startsWith('[')) {
      try {
        return fromJsonBody(JSON.parse(raw)) || `Request failed (${err.status})`
      } catch {
        return `Request failed (${err.status})`
      }
    }
    return raw.length > 200 ? `Request failed (${err.status})` : raw
  }
  if (err instanceof Error && err.message.trim()) return err.message.trim()
  return 'Request failed'
}

const isLoginPath = (path: string) => path.includes('/api/user/login/')

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const headers = new Headers(init?.headers)
  if (!headers.has('Accept')) headers.set('Accept', 'application/json')
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')

  // Login must work without a prior token; never attach a stale Bearer header.
  if (!isLoginPath(path)) {
    const token = await getToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
  }

  let res: Response
  try {
    res = await fetch(`${baseURL}${path}`, {
      ...init,
      headers,
    })
  } catch (err) {
    const message =
      err instanceof Error && err.message.trim()
        ? err.message.trim()
        : 'Network request failed'
    throw new Error(
      /network|failed to fetch|timed out|unreachable/i.test(message)
        ? 'Unable to reach the server. Check your connection and API URL.'
        : message,
    )
  }

  const text = await res.text().catch(() => '')
  let responseBody: unknown = text
  if (text) {
    try {
      responseBody = JSON.parse(text)
    } catch {
      responseBody = text
    }
  } else {
    responseBody = undefined
  }

  if (!res.ok) {
    // 401 = missing/invalid token → clear session (not 403 permission denied).
    if (res.status === 401 && !isLoginPath(path)) {
      await clearSession()
      notifyAuthInvalid()
    }
    throw new ApiError(res.status, text || res.statusText)
  }

  if (!text) return undefined as T
  return responseBody as T
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
