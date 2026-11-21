import { apiRequest } from './client'

export function listAircraft(options = {}) {
  return apiRequest('/aircraft', { signal: options.signal })
}
