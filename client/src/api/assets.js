import { apiRequest } from './client'

export function listAirstripAssets(airstripId, options = {}) {
  return apiRequest(`/airstrips/${airstripId}/assets`, { signal: options.signal })
}

export function createAirstripAsset(airstripId, payload, options = {}) {
  return apiRequest(`/airstrips/${airstripId}/assets`, {
    method: 'POST',
    body: payload,
    signal: options.signal,
  })
}

export function updateAssetStatus(assetId, payload, options = {}) {
  return apiRequest(`/assets/${assetId}/status`, {
    method: 'PATCH',
    body: payload,
    signal: options.signal,
  })
}
