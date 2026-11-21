import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import StatCard from '../components/StatCard'
import DataSourceBadge from '../components/DataSourceBadge'
import { useAuth } from '../context/AuthContext'
import { listAirstrips, listAircraft, rankAirstrips, useApi } from '../api'

const SECTOR_FILTERS = [
  { id: 'all', label: 'All India', sectorCode: 'SEC-IN-ALL', sectorName: 'National Regional Network', lat: '20.5937°N', lon: '78.9629°E', corridorTitle: 'NATIONAL REGIONAL SECTOR OVERVIEW', states: null },
  { id: 'south', label: 'South (KA/TN/TG)', dotColor: 'var(--accent)', sectorCode: 'SEC-SOUTH-01', sectorName: 'Peninsular Corridor', lat: '13.0760°N', lon: '77.5997°E', corridorTitle: 'PENINSULAR REGIONAL CORRIDOR', states: ['Karnataka', 'Tamil Nadu', 'Telangana', 'Andhra Pradesh', 'Kerala'] },
  { id: 'west', label: 'West (MH/GJ)', sectorCode: 'SEC-WEST-02', sectorName: 'Western Industrial Corridor', lat: '18.5204°N', lon: '73.8567°E', corridorTitle: 'WESTERN INDUSTRIAL CORRIDOR', states: ['Maharashtra', 'Gujarat', 'Goa'] },
  { id: 'north', label: 'North (DL/HR/UP/RJ)', sectorCode: 'SEC-NORTH-03', sectorName: 'Northern Regional Ring', lat: '28.5562°N', lon: '77.1000°E', corridorTitle: 'NORTHERN REGIONAL CORRIDOR', states: ['Delhi', 'Haryana', 'Uttar Pradesh', 'Rajasthan', 'Punjab', 'Uttarakhand'] },
]

function mapVerdictKey(feature, rankedEntry) {
  if (rankedEntry?.evaluation?.verdict) {
    const v = rankedEntry.evaluation.verdict
    if (v === 'viable') return 'viable'
    if (v === 'viable_with_conditions') return 'conditional'
    return 'nonviable'
  }
  const p = feature?.properties || {}
  const score = p.feasibility?.score ?? 0
  const polSeverity = (p.political_influence?.severity || 'none').toLowerCase()
  if (score >= 75 && polSeverity !== 'high') return 'viable'
  if (score >= 55) return 'conditional'
  return 'nonviable'
}

function mapConfidence(dataStatus, dataConfidence) {
  const status = (dataStatus || '').toLowerCase()
  if (status === 'field_verified' || dataConfidence === 'high') {
    return { label: 'FIELD VERIFIED', kind: 'field' }
  }
  if (status === 'desk_verified' || dataConfidence === 'medium') {
    return { label: 'DESK VERIFIED', kind: 'desk' }
  }
  return { label: 'UNVERIFIED / SYNTHETIC', kind: 'synthetic' }
}

function buildAuditCardModel(feature, rankedEntry) {
  const p = feature?.properties || {}
  const coords = feature?.geometry?.coordinates || [0, 0]
  const lon = Number(coords[0] ?? 0).toFixed(4)
  const lat = Number(coords[1] ?? 0).toFixed(4)
  const verdict = mapVerdictKey(feature, rankedEntry)
  const score = rankedEntry?.evaluation?.score ?? p.feasibility?.score ?? 0
  const surface = p.surface || 'unknown'
  const surfaceTitle = surface.charAt(0).toUpperCase() + surface.slice(1)
  const conf = mapConfidence(p.data_status, p.data_confidence)
  const reasons = rankedEntry?.reasons || p.feasibility?.reasons || []
  const warnings = rankedEntry?.evaluation?.warnings || []

  return {
    id: p.id,
    icao: `ID-${String(p.id ?? 0).padStart(2, '0')}`,
    name: p.name || 'Unnamed Strip',
    state: p.state || 'Unknown',
    locationText: `${p.state || 'India'} • ${lat}°N, ${lon}°E`,
    verdict,
    score,
    confidence: conf.label,
    confidenceKind: conf.kind,
    runwayPrimary: `${p.runway_length_m ? `${Number(p.runway_length_m).toLocaleString()}m` : 'N/A'} • ${surfaceTitle}`,
    runwaySecondary: p.runway_width_m ? `Width ${p.runway_width_m}m • Elev ${p.elevation_m ?? '--'}m` : `Elev ${p.elevation_m ?? '--'}m`,
    metric2Label: 'UTILITIES',
    metric2Value: p.charging_available ? 'EV Charge' : p.fuel_available ? 'Fuel Only' : 'Unverified / None',
    metric2Sub: p.night_landing ? 'Night Lighting' : 'Day VFR',
    metric3Label: 'NEAREST HUB',
    metric3Value: p.nearest_airport?.code || 'N/A',
    metric3Sub: Number.isFinite(p.nearest_airport?.distance_km) ? `${p.nearest_airport.distance_km} km` : 'Distance N/A',
    assessment: warnings[0] || reasons[0] || `Feasibility score ${score}/100 across runway, surface, utilities, and hub distance.`,
  }
}

function VerdictBadge({ verdict }) {
  const map = {
    viable: { label: 'VIABLE', cls: 'stitch-verdict-viable' },
    conditional: { label: 'CONDITIONAL', cls: 'stitch-verdict-conditional' },
    nonviable: { label: 'NOT VIABLE', cls: 'stitch-verdict-nonviable' },
  }
  const cfg = map[verdict] || map.conditional
  return <span className={`stitch-verdict-badge ${cfg.cls}`}>{cfg.label}</span>
}

function ConfidenceTag({ label, kind }) {
  return (
    <span className={`stitch-confidence-tag stitch-conf-${kind}`}>
      <span>{label}</span>
    </span>
  )
}

function AuditCardSkeleton() {
  return (
    <div className="stitch-audit-card stitch-audit-skeleton" aria-hidden="true">
      <div className="stitch-audit-head">
        <div>
          <div className="stitch-skeleton" style={{ width: 170, height: 20 }} />
          <div className="stitch-skeleton" style={{ width: 220, height: 12, marginTop: 8 }} />
        </div>
        <div className="stitch-skeleton" style={{ width: 88, height: 42 }} />
      </div>
      <div className="stitch-skeleton" style={{ width: '100%', height: 58 }} />
      <div className="stitch-skeleton" style={{ width: '85%', height: 14 }} />
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { token } = useAuth()
  const outletCtx = useOutletContext() || {}
  const globalSearch = outletCtx.globalSearch || ''
  const setGlobalSearch = outletCtx.setGlobalSearch

  const [activeSectorId, setActiveSectorId] = useState('all')
  const [activeAircraftId, setActiveAircraftId] = useState(null)
  const [verdictFilter, setVerdictFilter] = useState('all')
  const [sortMode, setSortMode] = useState('balanced')
  const [showFilterBar, setShowFilterBar] = useState(false)
  const [showAllAudits, setShowAllAudits] = useState(false)
  const [radarZoom, setRadarZoom] = useState(1)
  const [showRadarGrid, setShowRadarGrid] = useState(true)

  const airstripsQuery = useApi((signal) => listAirstrips({}, { signal }), [])
  const aircraftQuery = useApi((signal) => listAircraft({ signal }), [token], { enabled: Boolean(token) })

  const aircraftList = useMemo(() => aircraftQuery.data?.aircraft || [], [aircraftQuery.data])

  useEffect(() => {
    if (aircraftList.length > 0 && !activeAircraftId) {
      setActiveAircraftId(aircraftList[0].id)
    }
  }, [aircraftList, activeAircraftId])

  const rankQuery = useApi(
    (signal) =>
      rankAirstrips(
        { aircraftId: activeAircraftId, filters: { includeNotViable: true } },
        { signal }
      ),
    [activeAircraftId, token],
    { enabled: Boolean(token && activeAircraftId) }
  )

  const airstrips = useMemo(() => {
    const features = airstripsQuery.data?.features
    return Array.isArray(features) ? features : []
  }, [airstripsQuery.data])

  const dataSource = airstripsQuery.isUnavailable
    ? 'unavailable'
    : airstripsQuery.data?.data_source || null

  const caveatText =
    rankQuery.data?.caveat ||
    airstripsQuery.data?.caveat ||
    'Decision-support estimate. Verify with a site survey before committing.'

  const rankedById = useMemo(() => {
    const map = new Map()
    const results = rankQuery.data?.results || []
    for (const r of results) {
      const id = r?.airstrip?.id
      if (id !== undefined && id !== null) map.set(Number(id), r)
    }
    return map
  }, [rankQuery.data])

  const activeSector = useMemo(
    () => SECTOR_FILTERS.find((s) => s.id === activeSectorId) || SECTOR_FILTERS[0],
    [activeSectorId]
  )

  const activeAircraft = useMemo(
    () => aircraftList.find((a) => a.id === activeAircraftId) || null,
    [aircraftList, activeAircraftId]
  )

  const sectorStrips = useMemo(() => {
    if (!activeSector.states) return airstrips
    return airstrips.filter((f) => activeSector.states.includes(f.properties?.state))
  }, [airstrips, activeSector])

  const kpiStats = useMemo(() => {
    const total = sectorStrips.length
    let viable = 0
    let conditional = 0
    let nonviable = 0

    for (const f of sectorStrips) {
      const v = mapVerdictKey(f, rankedById.get(Number(f.properties?.id)))
      if (v === 'viable') viable += 1
      else if (v === 'conditional') conditional += 1
      else nonviable += 1
    }

    const viablePct = total > 0 ? ((viable / total) * 100).toFixed(1) : '0.0'
    const nonviablePct = total > 0 ? ((nonviable / total) * 100).toFixed(1) : '0.0'
    return { total, viable, conditional, nonviable, viablePct, nonviablePct }
  }, [sectorStrips, rankedById])

  const enrichedAudits = useMemo(
    () => sectorStrips.map((f) => buildAuditCardModel(f, rankedById.get(Number(f.properties?.id)))),
    [sectorStrips, rankedById]
  )

  const filteredAudits = useMemo(() => {
    const q = globalSearch.trim().toLowerCase()
    let list = enrichedAudits.filter((item) => {
      if (verdictFilter !== 'all' && item.verdict !== verdictFilter) return false
      if (!q) return true
      return (
        item.name.toLowerCase().includes(q) ||
        item.icao.toLowerCase().includes(q) ||
        item.state.toLowerCase().includes(q) ||
        item.locationText.toLowerCase().includes(q)
      )
    })

    if (sortMode === 'score_desc') {
      list = [...list].sort((a, b) => b.score - a.score)
    } else if (sortMode === 'runway_desc') {
      list = [...list].sort((a, b) => {
        const ra = parseInt((a.runwayPrimary.split('•')[0] || '0').replace(/\D/g, ''), 10)
        const rb = parseInt((b.runwayPrimary.split('•')[0] || '0').replace(/\D/g, ''), 10)
        return rb - ra
      })
    } else {
      const firstViable = list.find((x) => x.verdict === 'viable')
      const firstConditional = list.find((x) => x.verdict === 'conditional')
      const firstNonViable = list.find((x) => x.verdict === 'nonviable')
      const featured = [firstViable, firstConditional, firstNonViable].filter(Boolean)
      const featuredIds = new Set(featured.map((x) => x.id))
      const rest = list.filter((x) => !featuredIds.has(x.id)).sort((a, b) => b.score - a.score)
      list = [...featured, ...rest]
    }
    return list
  }, [enrichedAudits, globalSearch, verdictFilter, sortMode])

  const visibleAudits = useMemo(
    () => (showAllAudits ? filteredAudits : filteredAudits.slice(0, 3)),
    [filteredAudits, showAllAudits]
  )

  const topNodes = useMemo(() => filteredAudits.slice(0, 3), [filteredAudits])

  function handleExportCsv() {
    const header = ['ID', 'Code', 'Name', 'State', 'Verdict', 'Score', 'Runway', 'Confidence']
    const rows = filteredAudits.map((a) => [
      a.id,
      a.icao,
      `"${String(a.name).replace(/"/g, '""')}"`,
      `"${String(a.state).replace(/"/g, '""')}"`,
      a.verdict,
      a.score,
      `"${a.runwayPrimary}"`,
      `"${a.confidence}"`,
    ])
    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `aerogrid-${activeSector.id}-dossier.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  function resetAllFilters() {
    setActiveSectorId('all')
    setVerdictFilter('all')
    setSortMode('balanced')
    if (setGlobalSearch) setGlobalSearch('')
  }

  return (
    <div className="stitch-overview">
      {/* 1. Executive Sector Coordinate Ribbon */}
      <section className="stitch-ribbon" aria-label="Sector Focus Telemetry">
        <div className="stitch-ribbon-left">
          <div className="stitch-focus-pill">
            <span className="stitch-focus-label">SECTOR FOCUS</span>
            <strong className="stitch-focus-code">{activeSector.sectorCode}</strong>
            <span className="stitch-focus-sub">({activeSector.sectorName})</span>
          </div>

          <div className="stitch-datum-pill">
            <span className="stitch-datum-kicker">DATUM</span>
            <span className="stitch-datum-val">WGS-84 / EPSG:4326</span>
          </div>

          <div className="stitch-coord-strip tabular-num">
            <strong>LAT {activeSector.lat}</strong>
            <span aria-hidden="true">/</span>
            <strong>LON {activeSector.lon}</strong>
          </div>
        </div>

        <div className="stitch-ribbon-right">
          <DataSourceBadge source={dataSource} loading={airstripsQuery.loading} />

          <button
            type="button"
            className="stitch-recalibrate-btn"
            onClick={() => {
              airstripsQuery.refetch()
              if (token) aircraftQuery.refetch()
              if (token && activeAircraftId) rankQuery.refetch()
            }}
            disabled={airstripsQuery.loading}
          >
            <span>{airstripsQuery.loading ? 'SYNCHRONIZING...' : 'REFRESH DATA'}</span>
          </button>
        </div>
      </section>

      {/* Error / 503 Unavailable Banner */}
      {airstripsQuery.error && (
        <div className="stitch-error-banner" role="alert">
          <div className="stitch-error-copy">
            <strong>
              {airstripsQuery.isUnavailable ? 'Database / API Service Unavailable (503):' : 'API Request Failed:'}
            </strong>{' '}
            {airstripsQuery.error.message}
          </div>
          <button type="button" className="stitch-retry-btn" onClick={() => airstripsQuery.refetch()}>
            Retry Sync
          </button>
        </div>
      )}

      {/* 2. 4 KPI Stat Cards */}
      <section className="stitch-kpi-grid" aria-label="Sector Readiness KPIs">
        <StatCard
          variant="neutral"
          loading={airstripsQuery.loading}
          label="EVALUATED REGIONAL STRIPS"
          subtitle={activeSector.sectorName}
          value={kpiStats.total}
          deltaText={`${airstrips.length} indexed total`}
          footerLeft="PostGIS Registry"
          footerRight={activeAircraft ? activeAircraft.name : 'Feasibility Index'}
        />

        <StatCard
          variant="viable"
          loading={airstripsQuery.loading}
          label="VIABLE STRIPS"
          subtitle="Clear of Hard-Gate Failures"
          badgeText="PASS"
          value={kpiStats.viable}
          deltaText={`${kpiStats.viablePct}% of sector`}
          footerLeft="Runway & Surface Cleared"
          footerRight="Dispatch Ready"
        />

        <StatCard
          variant="conditional"
          loading={airstripsQuery.loading}
          label="CONDITIONAL NODES"
          subtitle="Warnings or Unverified Fields"
          badgeText="AMBER"
          value={kpiStats.conditional}
          deltaText="Site Verification Req."
          footerLeft="Utilities / Margin Watch"
          footerRight="Conditional Ops"
        />

        <StatCard
          variant="nonviable"
          loading={airstripsQuery.loading}
          label="NON-VIABLE STRIPS"
          subtitle="Hard-Gate or Low Score"
          badgeText="REJECT"
          value={kpiStats.nonviable}
          deltaText={`${kpiStats.nonviablePct}% of sector`}
          footerLeft="Runway / Surface / Risk"
          footerRight="Not Cleared"
        />
      </section>

      {/* 3. Main Workspace Split Deck (12 Columns: 7 Left, 5 Right) */}
      <section className="stitch-workspace-grid">
        {/* LEFT PANE: Sector Filters + Radar Overview + Elevation Summary */}
        <div className="stitch-left-pane">
          <div className="stitch-filter-bar">
            <div className="stitch-sector-pills" role="tablist" aria-label="Sector Region Filters">
              {SECTOR_FILTERS.map((sector) => {
                const isActive = sector.id === activeSectorId
                const labelText =
                  sector.id === 'all' ? `${sector.label} (${airstrips.length})` : sector.label
                return (
                  <button
                    key={sector.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={`stitch-sector-pill${isActive ? ' active' : ''}`}
                    onClick={() => setActiveSectorId(sector.id)}
                  >
                    {sector.dotColor && !isActive && (
                      <span
                        className="stitch-pill-dot"
                        style={{ backgroundColor: sector.dotColor }}
                        aria-hidden="true"
                      />
                    )}
                    <span>{labelText}</span>
                  </button>
                )
              })}
            </div>
            <div className="stitch-layer-tag">
              <span>ENGINE:</span>
              <strong>{activeAircraft ? activeAircraft.category.toUpperCase() : 'BASELINE'}</strong>
            </div>
          </div>

          <article className="stitch-mfd-card">
            <div className="stitch-mfd-header">
              <div className="stitch-mfd-title-group">
                <h2 className="stitch-mfd-title">{activeSector.corridorTitle}</h2>
                <span className="stitch-airspace-badge">{sectorStrips.length} SITES</span>
              </div>
              <div className="stitch-weather-strip tabular-num">
                <span className="stitch-weather-item">
                  {activeAircraft ? `MIN RWY ${activeAircraft.min_runway_m ?? '--'}m` : 'SELECT AIRCRAFT BELOW'}
                </span>
                <span className="stitch-weather-item">
                  {activeAircraft ? `RANGE ${activeAircraft.range_km ?? '--'} km` : 'SIGN IN FOR RANKING'}
                </span>
              </div>
            </div>

            <div className="stitch-radar-canvas">
              {showRadarGrid && <div className="stitch-radar-grid-bg" aria-hidden="true" />}
              <div className="stitch-crosshair-x" aria-hidden="true" />
              <div className="stitch-crosshair-y" aria-hidden="true" />

              <div className="stitch-radar-stage" style={{ '--radar-zoom': radarZoom }}>
                <div className="stitch-ring stitch-ring-10" aria-hidden="true"><span>10 NM</span></div>
                <div className="stitch-ring stitch-ring-20" aria-hidden="true"><span>20 NM</span></div>
                <div className="stitch-ring stitch-ring-30" aria-hidden="true"><span>30 NM</span></div>
                <div className="stitch-radar-sweep" aria-hidden="true" />

                {topNodes[0] && (
                  <button
                    type="button"
                    className="stitch-radar-node stitch-node-vojk"
                    onClick={() => navigate(`/map?strip=${topNodes[0].id}`)}
                  >
                    <span className="stitch-node-square stitch-node-blue">1</span>
                    <span className="stitch-node-tag">
                      <strong>{topNodes[0].name}</strong>
                      <small>{topNodes[0].runwayPrimary}</small>
                    </span>
                  </button>
                )}

                {topNodes[1] && (
                  <button
                    type="button"
                    className="stitch-radar-node stitch-node-vovk"
                    onClick={() => navigate(`/map?strip=${topNodes[1].id}`)}
                  >
                    <span className="stitch-node-square stitch-node-outline">2</span>
                    <span className="stitch-node-tag">
                      <strong>{topNodes[1].name}</strong>
                      <small>{topNodes[1].runwayPrimary}</small>
                    </span>
                  </button>
                )}

                {topNodes[2] && (
                  <button
                    type="button"
                    className="stitch-radar-node stitch-node-myq"
                    onClick={() => navigate(`/map?strip=${topNodes[2].id}`)}
                  >
                    <span className="stitch-node-diamond">3</span>
                    <span className="stitch-node-tag">
                      <strong>{topNodes[2].name}</strong>
                      <small>{topNodes[2].runwayPrimary}</small>
                    </span>
                  </button>
                )}
              </div>

              <div className="stitch-radar-hud">
                <div className="stitch-hud-head">
                  <span>DECISION ENGINE</span>
                  <strong>{activeAircraft ? activeAircraft.category.toUpperCase() : 'UNAUTHENTICATED'}</strong>
                </div>
                <div className="stitch-hud-speed tabular-num">
                  <span className="stitch-hud-ktas">{activeAircraft?.cruise_speed_kmh ?? '--'}</span>
                  <span className="stitch-hud-unit">KM/H CRUISE</span>
                </div>
                <div className="stitch-hud-grid tabular-num">
                  <div>MIN RWY: <strong>{activeAircraft?.min_runway_m ?? '--'}m</strong></div>
                  <div>RANGE: <strong>{activeAircraft?.range_km ?? '--'}km</strong></div>
                  <div>SEATS: <strong>{activeAircraft?.seats ?? '--'}</strong></div>
                  <div>PAYLOAD: <strong>{activeAircraft?.payload_kg ?? '--'}kg</strong></div>
                </div>
              </div>

              <div className="stitch-radar-controls">
                <button
                  type="button"
                  className="stitch-map-ctrl-btn"
                  onClick={() => setRadarZoom((z) => Math.min(1.25, +(z + 0.1).toFixed(2)))}
                  aria-label="Zoom radar in"
                >
                  +
                </button>
                <button
                  type="button"
                  className="stitch-map-ctrl-btn"
                  onClick={() => setRadarZoom((z) => Math.max(0.85, +(z - 0.1).toFixed(2)))}
                  aria-label="Zoom radar out"
                >
                  -
                </button>
                <button
                  type="button"
                  className={`stitch-map-ctrl-btn${showRadarGrid ? ' active' : ''}`}
                  onClick={() => setShowRadarGrid((v) => !v)}
                  aria-label="Toggle sectional grid overlay"
                >
                  #
                </button>
              </div>
            </div>

            <div className="stitch-mfd-footer tabular-num">
              <div className="stitch-mfd-footer-group">
                <span>CAVEAT: <strong>{caveatText}</strong></span>
              </div>
            </div>
          </article>
        </div>

        {/* RIGHT PANE: Priority Airfield Audits */}
        <div className="stitch-right-pane">
          <div className="stitch-audits-header">
            <div>
              <div className="stitch-audits-title-row">
                <h2>Priority Airfield Audits</h2>
                <span className="stitch-pip stitch-pip-green" aria-hidden="true" />
              </div>
              <div className="stitch-audits-sub">
                LIVE REGISTRY TELEMETRY ({filteredAudits.length} SITES)
              </div>
            </div>

            <div className="stitch-audits-controls">
              <button
                type="button"
                className={`stitch-small-ctrl-btn${showFilterBar ? ' active' : ''}`}
                onClick={() => setShowFilterBar((prev) => !prev)}
                aria-label="Filter airfield audits"
                aria-expanded={showFilterBar}
                title="Filter by verdict"
              >
                Filter
              </button>
              <button
                type="button"
                className="stitch-small-ctrl-btn"
                onClick={() =>
                  setSortMode((prev) =>
                    prev === 'balanced' ? 'score_desc' : prev === 'score_desc' ? 'runway_desc' : 'balanced'
                  )
                }
                aria-label={`Sort audits (current: ${sortMode})`}
                title={`Sort order: ${sortMode}`}
              >
                Sort
              </button>
            </div>
          </div>

          {showFilterBar && (
            <div className="stitch-verdict-filter-row" role="group" aria-label="Filter by audit verdict">
              {[
                { id: 'all', label: 'All Verdicts' },
                { id: 'viable', label: 'Viable' },
                { id: 'conditional', label: 'Conditional' },
                { id: 'nonviable', label: 'Not Viable' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`stitch-filter-chip${verdictFilter === opt.id ? ' active' : ''}`}
                  onClick={() => setVerdictFilter(opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {airstripsQuery.loading ? (
            <div className="stitch-audit-stack">
              <AuditCardSkeleton />
              <AuditCardSkeleton />
              <AuditCardSkeleton />
            </div>
          ) : airstripsQuery.error ? (
            <div className="stitch-empty-card">
              <div className="stitch-empty-title">Registry Data Unavailable</div>
              <p className="stitch-empty-desc">{airstripsQuery.error.message}</p>
              <button type="button" className="stitch-retry-btn" onClick={() => airstripsQuery.refetch()}>
                Retry
              </button>
            </div>
          ) : visibleAudits.length === 0 ? (
            <div className="stitch-empty-card">
              <div className="stitch-empty-title">No Matching Aerodromes in Current Filter</div>
              <p className="stitch-empty-desc">
                Adjust the search query, sector pill, or verdict filter to inspect regional airstrips.
              </p>
              <button type="button" className="stitch-retry-btn" onClick={resetAllFilters}>
                Reset Filters
              </button>
            </div>
          ) : (
            <>
              <div className="stitch-audit-stack">
                {visibleAudits.map((audit) => (
                  <article key={audit.id} className={`stitch-audit-card stitch-audit-${audit.verdict}`}>
                    <div className="stitch-audit-head">
                      <div>
                        <div className="stitch-audit-name-row">
                          <span className="stitch-audit-icao">{audit.icao}</span>
                          <h3 className="stitch-audit-name">{audit.name}</h3>
                        </div>
                        <div className="stitch-audit-loc tabular-num">{audit.locationText}</div>
                      </div>

                      <div className="stitch-audit-badges">
                        <VerdictBadge verdict={audit.verdict} />
                        <ConfidenceTag label={audit.confidence} kind={audit.confidenceKind} />
                      </div>
                    </div>

                    <div className="stitch-specs-matrix tabular-num">
                      <div className="stitch-spec-cell">
                        <span className="stitch-spec-k">RUNWAY</span>
                        <strong className="stitch-spec-v">{audit.runwayPrimary}</strong>
                        <span className="stitch-spec-sub">{audit.runwaySecondary}</span>
                      </div>
                      <div className="stitch-spec-cell">
                        <span className="stitch-spec-k">{audit.metric2Label}</span>
                        <strong className="stitch-spec-v">{audit.metric2Value}</strong>
                        <span className="stitch-spec-sub">{audit.metric2Sub}</span>
                      </div>
                      <div className="stitch-spec-cell">
                        <span className="stitch-spec-k">{audit.metric3Label}</span>
                        <strong className="stitch-spec-v">{audit.metric3Value}</strong>
                        <span className="stitch-spec-sub">{audit.metric3Sub}</span>
                      </div>
                    </div>

                    <div className={`stitch-assessment-line stitch-assess-${audit.verdict}`}>
                      <span>{audit.assessment}</span>
                    </div>

                    <div className="stitch-audit-footer">
                      <span className="stitch-audit-caveat">{caveatText}</span>
                      <button
                        type="button"
                        className="stitch-dossier-btn"
                        onClick={() => navigate(`/map?strip=${audit.id}`)}
                      >
                        <span>View Dossier</span>
                      </button>
                    </div>
                  </article>
                ))}
              </div>

              {filteredAudits.length > 3 && (
                <button
                  type="button"
                  className="stitch-show-more-btn"
                  onClick={() => setShowAllAudits((prev) => !prev)}
                >
                  {showAllAudits
                    ? 'Show Priority Trio Only'
                    : `Show All ${filteredAudits.length} Audited Sites`}
                </button>
              )}
            </>
          )}
        </div>
      </section>

      {/* 4. Bottom Aircraft Profile & Export Console */}
      <section className="stitch-console-banner" aria-label="Aircraft Evaluation Console">
        <div className="stitch-console-left">
          <div className="stitch-airframe-block">
            <div className="stitch-console-kicker">ACTIVE AIRCRAFT EVALUATION</div>
            {!token ? (
              <div className="stitch-corridor-meta">
                Sign in to load live aircraft profiles and run decision-engine rankings.{' '}
                <button type="button" className="inline-action-btn" onClick={() => navigate('/login')}>
                  Sign In
                </button>
              </div>
            ) : aircraftQuery.loading ? (
              <div className="stitch-corridor-meta">Loading aircraft profiles...</div>
            ) : aircraftQuery.error ? (
              <div className="stitch-corridor-meta">{aircraftQuery.error.message}</div>
            ) : aircraftList.length === 0 ? (
              <div className="stitch-corridor-meta">No aircraft profiles returned by API.</div>
            ) : (
              <div className="stitch-airframe-tabs" role="tablist" aria-label="Active Airframe">
                {aircraftList.map((ac) => {
                  const isSelected = ac.id === activeAircraftId
                  return (
                    <button
                      key={ac.id}
                      type="button"
                      role="tab"
                      aria-selected={isSelected}
                      className={`stitch-airframe-tab${isSelected ? ' active' : ''}`}
                      onClick={() => setActiveAircraftId(ac.id)}
                    >
                      {isSelected && <span className="stitch-pill-dot" style={{ backgroundColor: 'var(--accent)' }} aria-hidden="true" />}
                      <span>{ac.name}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="stitch-console-actions">
          <button type="button" className="stitch-export-btn" onClick={handleExportCsv} disabled={filteredAudits.length === 0}>
            <span>Export Sectional Dossier (CSV)</span>
          </button>

          <button type="button" className="stitch-primary-cta" onClick={() => navigate('/map')}>
            <span>Open Sector Feasibility Map →</span>
          </button>
        </div>
      </section>
    </div>
  )
}
