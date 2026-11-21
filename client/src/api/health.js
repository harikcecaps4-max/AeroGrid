import { apiRequest } from './client'

export function getHealth(options = {}) {
  return apiRequest('/health', {
    skipAuth: true,
    skipUnauthorizedHandler: true,
    signal: options.signal,
  })
}
