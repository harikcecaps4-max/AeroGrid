import { apiRequest } from './client'

export function login({ email, password }, options = {}) {
  return apiRequest('/auth/login', {
    method: 'POST',
    body: { email, password },
    skipAuth: true,
    skipUnauthorizedHandler: true,
    signal: options.signal,
  })
}

export function register({ email, password }, options = {}) {
  return apiRequest('/auth/register', {
    method: 'POST',
    body: { email, password },
    skipAuth: true,
    skipUnauthorizedHandler: true,
    signal: options.signal,
  })
}

export function loginWithGoogle({ idToken }, options = {}) {
  return apiRequest('/auth/google', {
    method: 'POST',
    body: { idToken },
    skipAuth: true,
    skipUnauthorizedHandler: true,
    signal: options.signal,
  })
}
