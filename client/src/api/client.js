const RAW_BASE = (import.meta.env.VITE_API_BASE || '/api').trim()
export const API_BASE = RAW_BASE.endsWith('/') ? RAW_BASE.slice(0, -1) : RAW_BASE

let tokenProvider = () => {
  try {
    return localStorage.getItem('aerogrid_token') || null
  } catch {
    return null
  }
}

let unauthorizedHandler = null

export function configureApiAuth({ getToken, onUnauthorized }) {
  if (typeof getToken === 'function') tokenProvider = getToken
  if (typeof onUnauthorized === 'function') unauthorizedHandler = onUnauthorized
}

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'HTTP_ERROR', data = null } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.data = data
    this.isUnauthorized = status === 401
    this.isUnavailable = status === 503
  }
}

function buildQuery(params) {
  if (!params) return ''
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') {
      sp.set(k, String(v))
    }
  }
  const qs = sp.toString()
  return qs ? `?${qs}` : ''
}

export async function apiRequest(
  path,
  { method = 'GET', params, body, token, signal, skipAuth = false, skipUnauthorizedHandler = false } = {}
) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const activeToken = !skipAuth ? (token !== undefined ? token : tokenProvider()) : null

  const queryParams = params ? { ...params } : {}
  let payload = body
  const headers = {}

  // Avoid CORS preflight (OPTIONS) by omitting Authorization header and sending text/plain JSON bodies.
  if (body !== undefined) {
    headers['Content-Type'] = 'text/plain'
    if (activeToken && body && typeof body === 'object' && !Array.isArray(body)) {
      payload = { ...body, _token: activeToken }
    }
  } else if (activeToken) {
    queryParams.access_token = activeToken
  }

  const url = `${API_BASE}${normalizedPath}${buildQuery(queryParams)}`

  let res
  try {
    res = await fetch(url, {
      method,
      headers,
      body: payload !== undefined ? JSON.stringify(payload) : undefined,
      signal,
    })
  } catch (err) {
    if (err?.name === 'AbortError') throw err
    throw new ApiError('Unable to reach the AeroGrid API server.', {
      status: 0,
      code: 'NETWORK_ERROR',
    })
  }

  let data = null
  try {
    data = await res.json()
  } catch {
    data = null
  }

  if (!res.ok) {
    if (res.status === 401 && !skipUnauthorizedHandler && typeof unauthorizedHandler === 'function') {
      unauthorizedHandler()
    }

    if (res.status === 503) {
      throw new ApiError(
        data?.message || 'AeroGrid database or backend service is currently unavailable.',
        { status: 503, code: 'UNAVAILABLE', data }
      )
    }

    throw new ApiError(
      data?.message || data?.error || `Request failed with status ${res.status}`,
      {
        status: res.status,
        code: res.status === 401 ? 'UNAUTHORIZED' : 'HTTP_ERROR',
        data,
      }
    )
  }

  return data
}
