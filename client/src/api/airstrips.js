import { apiRequest } from './client'

export function listAirstrips(params = {}, options = {}) {
  return apiRequest('/airstrips', { params, skipAuth: true, signal: options.signal })
}

export function getAirstripById(id, params = {}, options = {}) {
  return apiRequest(`/airstrips/${id}`, { params, skipAuth: true, signal: options.signal })
}

export function findAirstripsInRadius({ lat, lng, radius_km }, options = {}) {
  return apiRequest('/airstrips/radius', {
    params: { lat, lng, radius_km },
    skipAuth: true,
    signal: options.signal,
  })
}
