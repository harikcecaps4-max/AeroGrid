'use strict';

/**
 * Calculates feasibility score (0-100) and explainable breakdown for an airstrip.
 * @param {Object} strip - Airstrip record with specs and spatial distance metrics.
 * @returns {Object} Score details, rating tier, color, breakdown points, and rationale.
 */
function calculateFeasibilityScore(strip) {
  let runwayScore = 0;
  const runwayLen = Number(strip.runway_length_m) || 0;
  if (runwayLen >= 1500) {
    runwayScore = 25;
  } else if (runwayLen >= 1000) {
    runwayScore = 20;
  } else if (runwayLen >= 600) {
    runwayScore = 14;
  } else {
    runwayScore = 8;
  }

  let surfaceScore = 0;
  const surface = (strip.surface_name || '').toLowerCase();
  if (surface === 'asphalt' || surface === 'concrete') {
    surfaceScore = 20;
  } else if (surface === 'gravel') {
    surfaceScore = 12;
  } else {
    surfaceScore = 6;
  }

  let utilitiesScore = 0;
  if (strip.night_landing) utilitiesScore += 10;
  if (strip.fuel_available) utilitiesScore += 10;
  if (strip.charging_available) utilitiesScore += 10;

  let connectivityScore = 0;
  const airportDistKm = Number(strip.nearest_airport_distance_km) || 999;
  if (airportDistKm <= 50) {
    connectivityScore = 25;
  } else if (airportDistKm <= 100) {
    connectivityScore = 20;
  } else if (airportDistKm <= 200) {
    connectivityScore = 14;
  } else {
    connectivityScore = 8;
  }

  const totalScore = runwayScore + surfaceScore + utilitiesScore + connectivityScore;

  let rating = 'Low Viability';
  let color = '#ef4444'; // Red (< 40)
  if (totalScore >= 70) {
    rating = 'High Viability';
    color = '#22c55e'; // Green (>= 70)
  } else if (totalScore >= 40) {
    rating = 'Moderate Viability';
    color = '#f59e0b'; // Amber (40-69)
  }

  const reasons = [];
  reasons.push(
    runwayLen >= 1000
      ? `Runway length of ${runwayLen}m accommodates STOL, turboprop and light regional aircraft.`
      : `Short runway (${runwayLen}m) limits operations primarily to eVTOL and light STOL aircraft.`
  );
  reasons.push(`Pavement surface is ${surface || 'unpaved'} (${surfaceScore}/20 pts).`);

  const utilitiesList = [];
  if (strip.charging_available) utilitiesList.push('eVTOL charging');
  if (strip.fuel_available) utilitiesList.push('aviation fuel');
  if (strip.night_landing) utilitiesList.push('night landing lights');
  if (utilitiesList.length > 0) {
    reasons.push(`Available utilities: ${utilitiesList.join(', ')}.`);
  } else {
    reasons.push('No night landing, fuel, or charging infrastructure detected.');
  }

  reasons.push(
    strip.nearest_airport_name
      ? `Nearest commercial hub is ${strip.nearest_airport_name} (${airportDistKm} km away).`
      : `Regional hub distance: ${airportDistKm} km.`
  );

  return {
    score: totalScore,
    rating,
    color,
    breakdown: {
      runway: runwayScore,
      surface: surfaceScore,
      utilities: utilitiesScore,
      connectivity: connectivityScore,
    },
    reasons,
  };
}

module.exports = {
  calculateFeasibilityScore,
};