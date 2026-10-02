// A small fetch wrapper for /api/v1 on our own host: JSON or multipart in, JSON out, session cookie + CSRF
// (docs/api.md → Conventions, Authentication). Every failure becomes an ApiError with the API's error code.

const API_PREFIX = '/api/v1'
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const CSRF_COOKIE = 'csrftoken'

export class ApiError extends Error {
  /** HTTP status; 0 when the server could not be reached. */
  readonly status: number
  /** The `error` code of the response (`validation`, `invalid_token`, …) or a local one (`network`, …). */
  readonly code: string
  /** The whole error body: extra keys such as `fields` or `retry_after`. */
  readonly data: Record<string, unknown>

  constructor(status: number, code: string, data: Record<string, unknown> = {}) {
    super(`API ${status || 'network'}: ${code}`)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.data = data
  }

  /** Field errors of a `validation` error: `{"phone": ["required"]}`. */
  get fields(): Record<string, string[]> {
    const fields = this.data.fields
    if (!fields || typeof fields !== 'object') return {}
    const result: Record<string, string[]> = {}
    for (const [name, codes] of Object.entries(fields as Record<string, unknown>)) {
      const list = Array.isArray(codes) ? codes : [codes]
      result[name] = list.map((code) => String(code))
    }
    return result
  }
}

export function isApiError(error: unknown, code?: string): error is ApiError {
  return error instanceof ApiError && (code === undefined || error.code === code)
}

export function readCookie(name: string): string | null {
  const prefix = `${name}=`
  for (const part of document.cookie.split(';')) {
    const item = part.trim()
    if (item.startsWith(prefix)) return decodeURIComponent(item.slice(prefix.length))
  }
  return null
}

function apiUrl(path: string): string {
  return new URL(API_PREFIX + path, window.location.origin).toString()
}

function fallbackCode(status: number): string {
  if (status === 401) return 'auth_required'
  if (status === 403) return 'forbidden'
  if (status === 404) return 'not_found'
  if (status === 405) return 'method_not_allowed'
  if (status === 429) return 'too_many_requests'
  if (status >= 500) return 'server_error'
  return `http_${status}`
}

async function readJson(response: Response): Promise<{ ok: true; value: unknown } | { ok: false }> {
  const text = await response.text()
  if (!text) return { ok: true, value: undefined }
  try {
    return { ok: true, value: JSON.parse(text) as unknown }
  } catch {
    return { ok: false }
  }
}

async function send(method: string, path: string, init: { headers: Record<string, string>; body?: BodyInit; signal?: AbortSignal }) {
  try {
    return await fetch(apiUrl(path), { method, credentials: 'same-origin', ...init })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error
    throw new ApiError(0, 'network')
  }
}

let csrfRequest: Promise<void> | null = null

/** `GET /auth/csrf` — (re)sets the csrftoken cookie. Concurrent callers share one request. */
export function fetchCsrfCookie(): Promise<void> {
  csrfRequest ??= send('GET', '/auth/csrf', { headers: { Accept: 'application/json' } })
    .then(async (response) => {
      if (!response.ok) {
        const body = await readJson(response)
        const data = body.ok && body.value && typeof body.value === 'object' ? (body.value as Record<string, unknown>) : {}
        throw new ApiError(response.status, typeof data.error === 'string' ? data.error : fallbackCode(response.status), data)
      }
    })
    .finally(() => {
      csrfRequest = null
    })
  return csrfRequest
}

async function csrfToken(): Promise<string> {
  let token = readCookie(CSRF_COOKIE)
  if (!token) {
    await fetchCsrfCookie()
    token = readCookie(CSRF_COOKIE)
  }
  return token ?? ''
}

export interface RequestOptions {
  /** A JSON body. */
  json?: unknown
  /** A multipart body (file uploads). */
  form?: FormData
  signal?: AbortSignal
}

export async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const unsafe = UNSAFE_METHODS.has(method)
  for (let attempt = 0; ; attempt++) {
    const headers: Record<string, string> = { Accept: 'application/json' }
    let body: BodyInit | undefined
    if (options.form) {
      body = options.form
    } else if (options.json !== undefined) {
      headers['Content-Type'] = 'application/json'
      body = JSON.stringify(options.json)
    }
    if (unsafe) headers['X-CSRFToken'] = await csrfToken()

    const response = await send(method, path, { headers, body, signal: options.signal })
    const parsed = response.status === 204 ? ({ ok: true, value: undefined } as const) : await readJson(response)

    if (response.ok) {
      if (!parsed.ok) throw new ApiError(response.status, 'bad_response')
      return parsed.value as T
    }

    const data = parsed.ok && parsed.value && typeof parsed.value === 'object' ? (parsed.value as Record<string, unknown>) : {}
    const error = new ApiError(response.status, typeof data.error === 'string' ? data.error : fallbackCode(response.status), data)
    // A stale or missing CSRF cookie: get a fresh one and repeat the request once.
    if (unsafe && error.code === 'csrf_failed' && attempt === 0) {
      await fetchCsrfCookie()
      continue
    }
    throw error
  }
}
