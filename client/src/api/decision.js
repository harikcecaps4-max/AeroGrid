import { apiRequest } from './client'

export function evaluateAirstrip({ aircraftId, airstripId, options: evalOptions }, reqOptions = {}) {
  return apiRequest('/evaluate', {
    method: 'POST',
    body: { aircraftId, airstripId, ...(evalOptions ? { options: evalOptions } : {}) },
    signal: reqOptions.signal,
  })
}

export function rankAirstrips({ aircraftId, filters, options: evalOptions }, reqOptions = {}) {
  return apiRequest('/rank', {
    method: 'POST',
    body: {
      aircraftId,
      ...(filters ? { filters } : {}),
      ...(evalOptions ? { options: evalOptions } : {}),
    },
    signal: reqOptions.signal,
  })
}

export function compareAirstrips({ aircraftId, airstripIds, options: evalOptions }, reqOptions = {}) {
  return apiRequest('/compare', {
    method: 'POST',
    body: {
      aircraftId,
      airstripIds,
      ...(evalOptions ? { options: evalOptions } : {}),
    },
    signal: reqOptions.signal,
  })
}
