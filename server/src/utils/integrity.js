'use strict';

const crypto = require('crypto');

/**
 * Computes a deterministic SHA-256 integrity hash for an airstrip record.
 * Used to detect data tampering or accidental corruption in critical aviation metrics.
 */
function computeAirstripChecksum(strip) {
  const normalized = {
    id: strip.id,
    name: (strip.name || '').trim(),
    runway_length_m: Number(strip.runway_length_m) || 0,
    runway_width_m: Number(strip.runway_width_m) || 0,
    surface: (strip.surface_name || strip.surface || '').toLowerCase().trim(),
    coordinates: [
      Number(strip.longitude !== undefined ? strip.longitude : strip.coordinates ? strip.coordinates[0] : 0).toFixed(6),
      Number(strip.latitude !== undefined ? strip.latitude : strip.coordinates ? strip.coordinates[1] : 0).toFixed(6),
    ],
    political_severity: (strip.political_severity || 'none').toLowerCase(),
  };

  const payload = JSON.stringify(normalized);
  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Verifies if an existing airstrip matches its stored checksum.
 */
function verifyAirstripChecksum(strip, storedChecksum) {
  if (!storedChecksum) return true; // not yet fingerprinted
  const currentChecksum = computeAirstripChecksum(strip);
  return currentChecksum === storedChecksum;
}

module.exports = {
  computeAirstripChecksum,
  verifyAirstripChecksum,
};

