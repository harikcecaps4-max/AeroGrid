// replace when API exists
// Centralized sample telemetry, corridor profiles, airframe presets, and audit enrichment
// used by the Overview Command Deck where dedicated backend endpoints do not exist yet.

// replace when API exists
export const SECTOR_FILTERS = [
  {
    id: 'all',
    label: 'All India',
    sectorCode: 'SEC-SOUTH-01',
    sectorName: 'Bengaluru Urban Core',
    lat: '12.9716°N',
    lon: '77.5946°E',
    qnh: '1013.2 hPa',
    corridorTitle: 'VOJK • PENINSULAR HIGHWAY 01',
    states: null,
  },
  {
    id: 'blr',
    label: 'Bengaluru Hub (KA)',
    dotColor: 'var(--accent)',
    sectorCode: 'SEC-BLR-01',
    sectorName: 'Bengaluru – Hosur eVTOL Corridor',
    lat: '13.0760°N',
    lon: '77.5997°E',
    qnh: '1013.4 hPa',
    corridorTitle: 'VOJK • BENGALURU – HOSUR CORRIDOR',
    states: ['Karnataka', 'Tamil Nadu'],
  },
  {
    id: 'bom',
    label: 'Mumbai-Pune (MH)',
    sectorCode: 'SEC-BOM-02',
    sectorName: 'Mumbai – Pune Expressway Sector',
    lat: '18.5204°N',
    lon: '73.8567°E',
    qnh: '1011.8 hPa',
    corridorTitle: 'VABB • SAHYADRI EXPRESSWAY 02',
    states: ['Maharashtra'],
  },
  {
    id: 'del',
    label: 'National Capital (DL/HR)',
    sectorCode: 'SEC-DEL-03',
    sectorName: 'NCR Regional Mobility Ring',
    lat: '28.5562°N',
    lon: '77.1000°E',
    qnh: '1014.1 hPa',
    corridorTitle: 'VIDP • NCR RINGWAY 03',
    states: ['Delhi', 'Haryana', 'Uttar Pradesh', 'Rajasthan'],
  },
]

// replace when API exists
export const RADAR_TELEMETRY_SAMPLE = {
  datum: 'NavIC / GAGAN CALIBRATED • WGS 84 (EGM96)',
  airspaceClass: 'AIRSPACE CLASS D',
  wind: 'WIND 082° / 08KT',
  visibility: 'VIS > 10KM CAVOK',
  handoverLine: 'Class G ➔ Class D (HAL ATC SEC-2)',
  geometricAccuracy: 'RTK ±0.03m',
  gridDensity: '0.5m LiDAR MESH',
  corridorFrequency: '124.850 MHz',
  layerTag: 'MCS + OLS MESH',
  elevationProfile: {
    title: 'Vertical Flight Corridor Cross-Section (VOJK ➔ VOVK)',
    cruiseCeiling: "CRUISE CEILING 4,000' MSL",
    clearanceLabel: 'CLEARANCE: +840 FT ABOVE OBSTACLES',
    departureLabel: 'DEP: VOJK (914m MSL)',
    arrivalLabel: 'ARR: VOVK (872m MSL)',
  },
  missionCorridor: {
    origin: 'VOJK (Jakkur)',
    destination: 'VOVK (Hosur Vertipad)',
    sectorMeta: '28.4 NM Sector • Direct A-18 Waypoint Corridor',
  },
}

// replace when API exists
export const AIRFRAME_PRESETS = [
  {
    id: 'archer-midnight',
    label: 'Archer Midnight (VT-EM1)',
    callsign: 'VT-EM1',
    legDistance: '28.4 NM LEG',
    ktas: 125,
    altitudeFt: '3,500 FT',
    altitudeAgl: "3,500' AGL",
    heading: '142° MAG',
    eta: '14m 12s',
    soc: '82.4%',
  },
  {
    id: 'joby-s4',
    label: 'Joby S4 (VT-X04)',
    callsign: 'VT-X04',
    legDistance: '28.4 NM LEG',
    ktas: 165,
    altitudeFt: '4,000 FT',
    altitudeAgl: "4,000' AGL",
    heading: '142° MAG',
    eta: '10m 48s',
    soc: '86.0%',
  },
  {
    id: 'eve-air',
    label: 'Eve Air Mobility',
    callsign: 'VT-EVE',
    legDistance: '28.4 NM LEG',
    ktas: 110,
    altitudeFt: '3,200 FT',
    altitudeAgl: "3,200' AGL",
    heading: '142° MAG',
    eta: '16m 05s',
    soc: '79.5%',
  },
]

// replace when API exists
export const CANONICAL_AUDIT_ENRICHMENT = {
  Jakkur: {
    icao: 'VOJK',
    cityState: 'Bengaluru Urban, Karnataka',
    heading: '08/26',
    pcn: 'Asphalt (PCN 18)',
    confidence: 'FIELD AUDITED',
    confidenceKind: 'field',
    metric2Label: 'ELECTRIFICATION',
    metric2Value: '350kW MCS',
    metric2Sub: 'BESCOM Dedicated',
    metric3Label: 'TURNAROUND',
    metric3Value: '12 MIN',
    metric3Sub: 'Dual Pad Stand',
    assessment: 'Zero Obstacle Limitation Surface (OLS) breach. Direct high-voltage feeder on site.',
  },
  Begumpet: {
    icao: 'VOBH',
    cityState: 'Hyderabad, Telangana',
    heading: '09/27',
    pcn: 'Grooved Asphalt',
    confidence: 'DESK AUDITED',
    confidenceKind: 'desk',
    metric2Label: 'ELECTRIFICATION',
    metric2Value: '150kW CAPPED',
    metric2Sub: 'TSSPDCL Constrained',
    metric3Label: 'REQUIRED UPGRADE',
    metric3Value: '2.4MWh BESS',
    metric3Sub: 'Buffer Battery Unit',
    assessment: 'Substation capped at 150kW peak load; needs battery buffer ESS before commercial eVTOL turnarounds.',
  },
  Nanded: {
    icao: 'VOND',
    cityState: 'Nanded, Maharashtra',
    heading: '10/28',
    pcn: 'Bitumen (Fair)',
    confidence: 'SYNTHETIC OLS',
    confidenceKind: 'synthetic',
    metric2Label: 'OBSTACLE BREACH',
    metric2Value: '4.2° GLIDE SLOPE',
    metric2Sub: 'High-Tension Pylon',
    metric3Label: 'GRID CAP',
    metric3Value: '<50kW',
    metric3Sub: 'Rural Feeder Only',
    assessment: '400kV transmission line infringes southern transition surface. Re-routing required for eVTOL clearance.',
  },
  Baramati: {
    icao: 'VOBT',
    cityState: 'Baramati, Maharashtra',
    heading: '11/29',
    pcn: 'Asphalt (PCN 22)',
    confidence: 'FIELD AUDITED',
    confidenceKind: 'field',
  },
  Hosur: {
    icao: 'VOVK',
    cityState: 'Hosur, Tamil Nadu',
    heading: '09/27',
    pcn: 'Asphalt (PCN 24)',
    confidence: 'FIELD AUDITED',
    confidenceKind: 'field',
  },
}

/**
 * Classifies an airstrip feature into Stitch's 3 operational verdicts:
 *   viable (>= 75 & no high/moderate political block) | conditional (>= 55) | nonviable (< 55)
 */
export function classifyVerdict(feature) {
  const p = feature?.properties || {}
  const score = p.feasibility?.score ?? 0
  const polSeverity = (p.political_influence?.severity || 'none').toLowerCase()

  if (score >= 75 && polSeverity !== 'high') return 'viable'
  if (score >= 55) return 'conditional'
  return 'nonviable'
}

/**
 * Maps an API/fallback airstrip GeoJSON Feature to an enriched Stitch Audit Card view model.
 */
export function deriveAuditCardModel(feature) {
  const p = feature?.properties || {}
  const coords = feature?.geometry?.coordinates || [0, 0]
  const lon = Number(coords[0] ?? 0).toFixed(4)
  const lat = Number(coords[1] ?? 0).toFixed(4)
  const verdict = classifyVerdict(feature)

  const canonicalKey = Object.keys(CANONICAL_AUDIT_ENRICHMENT).find((k) =>
    (p.name || '').toLowerCase().includes(k.toLowerCase())
  )
  const override = canonicalKey ? CANONICAL_AUDIT_ENRICHMENT[canonicalKey] : null

  const fallbackIcao = `IN-${String(p.id ?? 0).padStart(2, '0')}`
  const surfaceTitle = (p.surface || 'unknown').charAt(0).toUpperCase() + (p.surface || 'unknown').slice(1)

  const metric2Label =
    override?.metric2Label || (verdict === 'nonviable' ? 'OBSTACLE / RISK' : 'ELECTRIFICATION')
  const metric2Value =
    override?.metric2Value ||
    (p.charging_available
      ? '350kW MCS'
      : verdict === 'conditional'
        ? '150kW CAPPED'
        : '<50kW FEEDER')
  const metric2Sub =
    override?.metric2Sub ||
    (p.charging_available
      ? 'Dedicated EV Bay'
      : p.fuel_available
        ? 'Avgas / Fuel Available'
        : 'Grid Upgrade Needed')

  const metric3Label =
    override?.metric3Label ||
    (verdict === 'viable' ? 'TURNAROUND' : verdict === 'conditional' ? 'REQUIRED UPGRADE' : 'GRID CAP')
  const metric3Value =
    override?.metric3Value ||
    (verdict === 'viable' ? '12 MIN' : verdict === 'conditional' ? '2.4MWh BESS' : `${p.nearest_airport?.distance_km ?? '--'} km`)
  const metric3Sub =
    override?.metric3Sub ||
    (verdict === 'viable'
      ? p.night_landing
        ? 'Night PAPI Active'
        : 'Day VFR Stand'
      : p.nearest_airport?.code
        ? `Hub ${p.nearest_airport.code}`
        : 'Rural Feeder Only')

  const confidence =
    override?.confidence ||
    (verdict === 'viable' ? 'FIELD AUDITED' : verdict === 'conditional' ? 'DESK AUDITED' : 'SYNTHETIC OLS')
  const confidenceKind =
    override?.confidenceKind ||
    (verdict === 'viable' ? 'field' : verdict === 'conditional' ? 'desk' : 'synthetic')

  const hasPoliticalAlert =
    p.political_influence?.severity && p.political_influence.severity !== 'none'
  const reasonSummary = Array.isArray(p.feasibility?.reasons) && p.feasibility.reasons.length > 0
    ? p.feasibility.reasons.slice(0, 2).join(' ')
    : null

  const assessment =
    override?.assessment ||
    (hasPoliticalAlert ? p.political_influence?.details : null) ||
    reasonSummary ||
    'Decision-support telemetry synthesized from runway & connectivity vectors.'

  return {
    id: p.id,
    icao: override?.icao || fallbackIcao,
    name: p.name || 'Unnamed Airstrip',
    state: p.state || 'India',
    locationText: `${override?.cityState || p.state || 'Regional Sector'} • ${lat}° N, ${lon}° E`,
    verdict,
    score: p.feasibility?.score ?? 0,
    confidence,
    confidenceKind,
    runwayPrimary: `${override?.heading || '09/27'} • ${p.runway_length_m ?? 0}m`,
    runwaySecondary: override?.pcn || surfaceTitle,
    metric2Label,
    metric2Value,
    metric2Sub,
    metric3Label,
    metric3Value,
    metric3Sub,
    assessment,
    nearestHub: p.nearest_airport,
  }
}
