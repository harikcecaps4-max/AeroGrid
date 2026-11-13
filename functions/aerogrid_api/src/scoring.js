'use strict';

/**
 * Calculates feasibility score (0-100) and explainable breakdown for an airstrip,
 * incorporating infrastructure capability, connectivity, and political/regulatory stability.
 * 
 * @param {Object} strip - Airstrip record with specs, spatial metrics, and political risk data.
 * @returns {Object} Score details, rating tier, color, breakdown points, political risk assessment, and rationale.
 */
function calculateFeasibilityScore(strip) {
  // 1. Runway capability (max 25 pts)
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

  // 2. Surface type (max 20 pts)
  let surfaceScore = 0;
  const surface = (strip.surface_name || strip.surface || '').toLowerCase();
  if (surface === 'asphalt' || surface === 'concrete') {
    surfaceScore = 20;
  } else if (surface === 'gravel') {
    surfaceScore = 12;
  } else {
    surfaceScore = 6;
  }

  // 3. Operational Utilities (max 30 pts)
  let utilitiesScore = 0;
  if (strip.night_landing) utilitiesScore += 10;
  if (strip.fuel_available) utilitiesScore += 10;
  if (strip.charging_available) utilitiesScore += 10;

  // 4. Regional Connectivity (max 25 pts)
  let connectivityScore = 0;
  const airportDistKm = Number(strip.nearest_airport_distance_km) || 
    (strip.nearest_airport && Number(strip.nearest_airport.distance_km)) || 999;
  if (airportDistKm <= 50) {
    connectivityScore = 25;
  } else if (airportDistKm <= 100) {
    connectivityScore = 20;
  } else if (airportDistKm <= 200) {
    connectivityScore = 14;
  } else {
    connectivityScore = 8;
  }

  const baseScore = runwayScore + surfaceScore + utilitiesScore + connectivityScore;

  // 5. Political Influence & Service Disruption Penalty Evaluation
  // Severity Levels:
  // - 'none': 0 pts penalty (Stable operational environment)
  // - 'low': 5 pts penalty (Occasional bureaucratical clearance delays / minor municipal reviews)
  // - 'moderate': 15 pts penalty (Frequent political strikes, local union friction, or zoning contestation)
  // - 'high': 28 pts penalty (Severe political intervention, land acquisition disputes, suspension threats)
  let politicalRisk = {
    has_influence: false,
    severity: 'none', // 'none' | 'low' | 'moderate' | 'high'
    penalty_points: 0,
    disruption_type: 'No Disruption Reported',
    details: 'Stable jurisdiction with predictable administrative continuity.'
  };

  const rawSeverity = (strip.political_severity || (strip.political_influence && strip.political_influence.severity) || 'none').toLowerCase();
  const rawDetails = strip.political_details || (strip.political_influence && strip.political_influence.details) || null;
  const rawDisruption = strip.disruption_type || (strip.political_influence && strip.political_influence.disruption_type) || null;

  if (rawSeverity === 'high') {
    politicalRisk = {
      has_influence: true,
      severity: 'high',
      penalty_points: 28,
      disruption_type: rawDisruption || 'Operational Suspension & Land Contestation',
      details: rawDetails || 'Severe political dispute, local jurisdiction intervention, or regulatory freeze causing frequent schedule disruptions.'
    };
  } else if (rawSeverity === 'moderate') {
    politicalRisk = {
      has_influence: true,
      severity: 'moderate',
      penalty_points: 15,
      disruption_type: rawDisruption || 'Municipal Clashes & Union Friction',
      details: rawDetails || 'Moderate political influence; periodic route permits contested by regional party dynamics or labor strikes.'
    };
  } else if (rawSeverity === 'low') {
    politicalRisk = {
      has_influence: true,
      severity: 'low',
      penalty_points: 5,
      disruption_type: rawDisruption || 'Administrative Clearance Delays',
      details: rawDetails || 'Minor regulatory delays during state election cycles and local authority leadership changes.'
    };
  }

  // Calculate Final Feasibility Score after Political Disruption Adjustment
  const totalScore = Math.max(0, Math.min(100, baseScore - politicalRisk.penalty_points));

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

  const airportName = strip.nearest_airport_name || (strip.nearest_airport && strip.nearest_airport.name);
  reasons.push(
    airportName
      ? `Nearest commercial hub is ${airportName} (${airportDistKm} km away).`
      : `Regional hub distance: ${airportDistKm} km.`
  );

  // Political Impact Note
  if (politicalRisk.has_influence) {
    reasons.push(
      `⚠️ Political Risk [${politicalRisk.severity.toUpperCase()} SEVERITY]: -${politicalRisk.penalty_points} pts penalty applied due to ${politicalRisk.disruption_type.toLowerCase()} (${politicalRisk.details}).`
    );
  } else {
    reasons.push('✓ Political Stability: No political disruption detected; operational environment is stable.');
  }

  return {
    score: totalScore,
    base_score: baseScore,
    rating,
    color,
    breakdown: {
      runway: runwayScore,
      surface: surfaceScore,
      utilities: utilitiesScore,
      connectivity: connectivityScore,
    },
    political_risk: politicalRisk,
    reasons,
  };
}

module.exports = {
  calculateFeasibilityScore,
};
