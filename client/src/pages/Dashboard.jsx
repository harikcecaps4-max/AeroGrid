import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import StatCard from '../components/StatCard'
import { MOCK_AIRSTRIPS } from '../data/mockData'
import {
  SECTOR_FILTERS,
  RADAR_TELEMETRY_SAMPLE,
  AIRFRAME_PRESETS,
  classifyVerdict,
  deriveAuditCardModel,
} from '../data/overviewSampleData'

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
      {kind === 'field' && (
        <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M10 2.5l2.2 1.8 2.8-.2.8 2.7 2.2 1.7-1.2 2.5.4 2.8-2.6 1-1.3 2.5-2.8-.3-2.5 1.3-1-2.6-2.8-.4.4-2.8-1.2-2.5 2.2-1.7.8-2.7 2.8.2z" />
          <polyline points="7 10.2 9.2 12.4 13.4 8.2" />
        </svg>
      )}
      {kind === 'desk' && (
        <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
          <rect x="2.5" y="3.5" width="15" height="10" rx="1.5" />
          <line x1="7" y1="16.5" x2="13" y2="16.5" strokeLinecap="round" />
          <line x1="10" y1="13.5" x2="10" y2="16.5" />
        </svg>
      )}
      {kind === 'synthetic' && (
        <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
          <circle cx="10" cy="10" r="6.5" />
          <circle cx="10" cy="10" r="2" />
        </svg>
      )}
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
  const outletCtx = useOutletContext() || {}
  const globalSearch = outletCtx.globalSearch || ''
  const setGlobalSearch = outletCtx.setGlobalSearch

  const [airstrips, setAirstrips] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncError, setSyncError] = useState(false)
  const [activeSectorId, setActiveSectorId] = useState('all')
  const [activeAirframeId, setActiveAirframeId] = useState(AIRFRAME_PRESETS[0].id)
  const [verdictFilter, setVerdictFilter] = useState('all')
  const [sortMode, setSortMode] = useState('balanced')
  const [showFilterBar, setShowFilterBar] = useState(false)
  const [showAllAudits, setShowAllAudits] = useState(false)
  const [radarZoom, setRadarZoom] = useState(1)
  const [showRadarGrid, setShowRadarGrid] = useState(true)

  async function loadRegistry(signal) {
    setLoading(true)
    setSyncError(false)
    try {
      const res = await fetch('/api/airstrips', { signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      const features = json.features ?? json
      setAirstrips(Array.isArray(features) && features.length > 0 ? features : MOCK_AIRSTRIPS)
    } catch (err) {
      if (err.name !== 'AbortError') {
        setAirstrips(MOCK_AIRSTRIPS)
        setSyncError(true)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    loadRegistry(controller.signal)
    return () => controller.abort()
  }, [])

  const activeSector = useMemo(
    () => SECTOR_FILTERS.find((s) => s.id === activeSectorId) || SECTOR_FILTERS[0],
    [activeSectorId]
  )

  const activeAirframe = useMemo(
    () => AIRFRAME_PRESETS.find((a) => a.id === activeAirframeId) || AIRFRAME_PRESETS[0],
    [activeAirframeId]
  )

  const sectorStrips = useMemo(() => {
    if (!activeSector.states) return airstrips
    return airstrips.filter((f) => activeSector.states.includes(f.properties?.state))
  }, [airstrips, activeSector])

  const kpiStats = useMemo(() => {
    const base = sectorStrips
    const total = base.length
    let viable = 0
    let conditional = 0
    let nonviable = 0

    for (const f of base) {
      const v = classifyVerdict(f)
      if (v === 'viable') viable += 1
      else if (v === 'conditional') conditional += 1
      else nonviable += 1
    }

    const viablePct = total > 0 ? ((viable / total) * 100).toFixed(1) : '0.0'
    const nonviablePct = total > 0 ? ((nonviable / total) * 100).toFixed(1) : '0.0'
    return { total, viable, conditional, nonviable, viablePct, nonviablePct }
  }, [sectorStrips])

  const enrichedAudits = useMemo(() => sectorStrips.map(deriveAuditCardModel), [sectorStrips])

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
        const ra = parseInt((a.runwayPrimary.split('•')[1] || '0').replace(/\D/g, ''), 10)
        const rb = parseInt((b.runwayPrimary.split('•')[1] || '0').replace(/\D/g, ''), 10)
        return rb - ra
      })
    } else {
      // 'balanced': highlight highest-confidence representative strips across verdicts first
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

  function handleExportCsv() {
    const header = ['ID', 'ICAO', 'Name', 'State', 'Verdict', 'Score', 'Runway', 'Confidence']
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
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
              <circle cx="10" cy="10" r="6" />
              <circle cx="10" cy="10" r="2" fill="currentColor" />
              <line x1="10" y1="1.5" x2="10" y2="4" />
              <line x1="10" y1="16" x2="10" y2="18.5" />
              <line x1="1.5" y1="10" x2="4" y2="10" />
              <line x1="16" y1="10" x2="18.5" y2="10" />
            </svg>
            <span className="stitch-focus-label">SECTOR FOCUS</span>
            <strong className="stitch-focus-code">{activeSector.sectorCode}</strong>
            <span className="stitch-focus-sub">({activeSector.sectorName})</span>
          </div>

          <div className="stitch-datum-pill">
            <span className="stitch-datum-kicker">DATUM</span>
            <span className="stitch-datum-val">{RADAR_TELEMETRY_SAMPLE.datum}</span>
          </div>

          <div className="stitch-coord-strip tabular-num">
            <strong>LAT {activeSector.lat}</strong>
            <span aria-hidden="true">/</span>
            <strong>LON {activeSector.lon}</strong>
            <span aria-hidden="true">/</span>
            <span className="stitch-qnh">QNH {activeSector.qnh}</span>
          </div>
        </div>

        <div className="stitch-ribbon-right">
          {syncError ? (
            <div className="stitch-lock-badge stitch-lock-fallback" role="status">
              <span className="stitch-pip stitch-pip-conditional" aria-hidden="true" />
              <span>OFFLINE SAMPLE CACHE</span>
            </div>
          ) : (
            <div className="stitch-lock-badge" role="status">
              <span className="stitch-pip stitch-pip-green stitch-pulse" aria-hidden="true" />
              <span>REAL-TIME TELEMETRY LOCK</span>
            </div>
          )}

          <button
            type="button"
            className="stitch-recalibrate-btn"
            onClick={() => loadRegistry()}
            disabled={loading}
          >
            <svg
              className={loading ? 'stitch-spin' : ''}
              width="15"
              height="15"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              aria-hidden="true"
            >
              <path d="M16.5 10a6.5 6.5 0 1 1-1.9-4.6L17 7.8" strokeLinecap="round" strokeLinejoin="round" />
              <polyline points="17 3.5 17 7.8 12.7 7.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>{loading ? 'SYNCHRONIZING...' : 'RECALIBRATE VECTOR'}</span>
          </button>
        </div>
      </section>

      {/* Error State Banner (with non-blocking fallback cache) */}
      {syncError && (
        <div className="stitch-error-banner" role="alert">
          <div className="stitch-error-copy">
            <strong>API Telemetry Unreachable:</strong> Live backend endpoint `/api/airstrips` did not respond. Displaying verified offline registry cache so decision-support workflows remain inspectable.
          </div>
          <button type="button" className="stitch-retry-btn" onClick={() => loadRegistry()}>
            Retry Sync
          </button>
        </div>
      )}

      {/* 2. 4 KPI Stat Cards */}
      <section className="stitch-kpi-grid" aria-label="Sector Readiness KPIs">
        <StatCard
          variant="neutral"
          loading={loading}
          label="EVALUATED REGIONAL STRIPS"
          subtitle="Peninsular Air Corridor"
          value={kpiStats.total}
          deltaText="+8 audited"
          deltaPrefixIcon={
            <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
              <line x1="10" y1="15" x2="10" y2="5" strokeLinecap="round" />
              <polyline points="6 9 10 5 14 9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
          icon={
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="3" y="3" width="14" height="14" rx="2" />
              <polyline points="6.5 10.2 9 12.6 13.8 7.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
          footerLeft="DGCA & AAI Register"
          footerRight="98.2% Trust Index"
        />

        <StatCard
          variant="viable"
          loading={loading}
          label="VIABLE VERTIPADS"
          subtitle="350kW+ MCS Electrified"
          badgeText="PASS"
          value={kpiStats.viable}
          deltaText={`${kpiStats.viablePct}% of total`}
          footerLeft="Paved Asphalt >750m"
          footerRight="Immediate Dispatch"
        />

        <StatCard
          variant="conditional"
          loading={loading}
          label="CONDITIONAL NODES"
          subtitle="Substation & Buffer Bound"
          badgeText="AMBER"
          value={kpiStats.conditional}
          deltaText="Grid Capped (<150kW)"
          footerLeft="Requires BESS Buffer"
          footerRight="CapEx Upgrade Req."
        />

        <StatCard
          variant="nonviable"
          loading={loading}
          label="NON-VIABLE STRIPS"
          subtitle="OLS / Terrain Infringed"
          badgeText="REJECT"
          value={kpiStats.nonviable}
          deltaText={`${kpiStats.nonviablePct}% of sector`}
          footerLeft="Glide Slope Infringement"
          footerRight="HT Line Breach"
        />
      </section>

      {/* 3. Main Workspace Split Deck (12 Columns: 7 Left, 5 Right) */}
      <section className="stitch-workspace-grid">
        {/* LEFT PANE: Sector Filters + Aeronautical Radar MFD + Vertical Cross Section */}
        <div className="stitch-left-pane">
          {/* Sector Filter Bar */}
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
              <span>LAYER:</span>
              <strong>{RADAR_TELEMETRY_SAMPLE.layerTag}</strong>
            </div>
          </div>

          {/* Aeronautical Radar MFD Card */}
          <article className="stitch-mfd-card">
            <div className="stitch-mfd-header">
              <div className="stitch-mfd-title-group">
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="var(--chart-blue)" strokeWidth="1.9" aria-hidden="true">
                  <circle cx="10" cy="10" r="7.5" />
                  <polygon points="13 7 11.2 11.2 7 13 8.8 8.8" fill="var(--chart-blue)" stroke="none" />
                </svg>
                <h2 className="stitch-mfd-title">{activeSector.corridorTitle}</h2>
                <span className="stitch-airspace-badge">{RADAR_TELEMETRY_SAMPLE.airspaceClass}</span>
              </div>

              <div className="stitch-weather-strip tabular-num">
                <span className="stitch-weather-item">
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="var(--chart-blue)" strokeWidth="1.8" aria-hidden="true">
                    <path d="M3 8h9a2.5 2.5 0 1 0-2.5-2.5" strokeLinecap="round" />
                    <path d="M3 12h12a2.5 2.5 0 1 1-2.5 2.5" strokeLinecap="round" />
                  </svg>
                  {RADAR_TELEMETRY_SAMPLE.wind}
                </span>
                <span className="stitch-weather-item">
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="var(--text-ink)" strokeWidth="1.8" aria-hidden="true">
                    <path d="M2 10s3.2-5 8-5 8 5 8 5-3.2 5-8 5-8-5-8-5z" />
                    <circle cx="10" cy="10" r="2" />
                  </svg>
                  {RADAR_TELEMETRY_SAMPLE.visibility}
                </span>
              </div>
            </div>

            {/* Warm Sectional Radar Canvas */}
            <div className="stitch-radar-canvas">
              {showRadarGrid && <div className="stitch-radar-grid-bg" aria-hidden="true" />}
              <div className="stitch-crosshair-x" aria-hidden="true" />
              <div className="stitch-crosshair-y" aria-hidden="true" />

              {/* Scaled concentric radar geometry */}
              <div
                className="stitch-radar-stage"
                style={{ '--radar-zoom': radarZoom }}
              >
                <div className="stitch-ring stitch-ring-10" aria-hidden="true">
                  <span>10 NM</span>
                </div>
                <div className="stitch-ring stitch-ring-20" aria-hidden="true">
                  <span>20 NM</span>
                </div>
                <div className="stitch-ring stitch-ring-30" aria-hidden="true">
                  <span>30 NM</span>
                </div>
                <div className="stitch-radar-sweep" aria-hidden="true" />

                <svg className="stitch-radar-vectors" viewBox="0 0 700 520" preserveAspectRatio="none" aria-hidden="true">
                  <path d="M 330 220 L 495 370" stroke="#2f6fba" strokeDasharray="6 4" strokeWidth="2.5" fill="none" />
                  <path d="M 330 220 L 215 415" stroke="#c04600" strokeDasharray="4 4" strokeWidth="1.6" fill="none" />
                  <path d="M 110 295 Q 350 225 585 325" fill="none" stroke="#727782" strokeDasharray="2 4" strokeWidth="1.2" />
                </svg>

                {/* Node 1: VOJK Jakkur Hub */}
                <button
                  type="button"
                  className="stitch-radar-node stitch-node-vojk"
                  onClick={() => navigate('/map')}
                  title="Open VOJK Jakkur Aerodrome on Aeronautical Map"
                >
                  <span className="stitch-node-square stitch-node-blue">
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
                      <path d="M3 14.5h14M5.5 11.5l3-1.8 2.2-4.8 1.5 1.1-.8 3.2 3.8-1.4 1.6 1.1-5.8 3.1-5.5-.5z" />
                    </svg>
                  </span>
                  <span className="stitch-node-tag">
                    <strong>VOJK <span className="stitch-tag-accent">● HUB</span></strong>
                    <small>RWY 08/26 • 900m</small>
                  </span>
                </button>

                {/* Active In-Flight Aircraft */}
                <div className="stitch-radar-node stitch-node-flight">
                  <span className="stitch-flight-puck" aria-hidden="true">
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                      <polygon points="10,2 17,17 10,13.5 3,17" />
                    </svg>
                  </span>
                  <span className="stitch-flight-tag tabular-num">
                    <strong>{activeAirframe.callsign}</strong>
                    <small>{activeAirframe.altitudeAgl}</small>
                  </span>
                </div>

                {/* Node 2: VOVK Hosur Vertipad */}
                <button
                  type="button"
                  className="stitch-radar-node stitch-node-vovk"
                  onClick={() => navigate('/map')}
                  title="Open VOVK Hosur Vertipad on Aeronautical Map"
                >
                  <span className="stitch-node-square stitch-node-outline">
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                      <rect x="4" y="4" width="8.5" height="12" rx="1.2" />
                      <path d="M12.5 8h2a1.5 1.5 0 0 1 1.5 1.5V14a1 1 0 0 1-2 0v-2" />
                      <polyline points="8.5 7 7 10.2 9.5 10.2 8 13" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span className="stitch-node-tag">
                    <strong>VOVK <span className="stitch-tag-accent">MCS 480V</span></strong>
                    <small>RWY 09/27 • 2100m</small>
                  </span>
                </button>

                {/* Node 3: MYQ-SECTOR Unpaved Diamond */}
                <button
                  type="button"
                  className="stitch-radar-node stitch-node-myq"
                  onClick={() => navigate('/map')}
                  title="Inspect MYQ-SECTOR Unpaved Strip"
                >
                  <span className="stitch-node-diamond">
                    <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.1" aria-hidden="true">
                      <polygon points="10,3 18,16 2,16" strokeLinejoin="round" />
                      <line x1="10" y1="8.5" x2="10" y2="12" strokeLinecap="round" />
                      <circle cx="10" cy="14" r="0.7" fill="currentColor" />
                    </svg>
                  </span>
                  <span className="stitch-node-tag">
                    <strong>MYQ-SECTOR</strong>
                    <small className="stitch-tag-warn">UNPAVED / TURF</small>
                  </span>
                </button>
              </div>

              {/* Floating Top-Left HUD Box */}
              <div className="stitch-radar-hud">
                <div className="stitch-hud-head">
                  <span>ACTIVE TRACKING</span>
                  <strong>{activeAirframe.legDistance}</strong>
                </div>
                <div className="stitch-hud-speed tabular-num">
                  <span className="stitch-hud-ktas">{activeAirframe.ktas}</span>
                  <span className="stitch-hud-unit">KTAS CRUISE</span>
                </div>
                <div className="stitch-hud-grid tabular-num">
                  <div>ALT: <strong>{activeAirframe.altitudeFt}</strong></div>
                  <div>HDG: <strong className="stitch-blue">{activeAirframe.heading}</strong></div>
                  <div>ETA: <strong>{activeAirframe.eta}</strong></div>
                  <div>SOC: <strong className="stitch-green">{activeAirframe.soc}</strong></div>
                </div>
              </div>

              {/* Bottom-Left Handover Banner */}
              <div className="stitch-handover-pill">
                <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="var(--chart-blue)" strokeWidth="1.9" aria-hidden="true">
                  <path d="M4 7h12l-3-3M16 13H4l3 3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>
                  HANDOVER LINE: <strong>{RADAR_TELEMETRY_SAMPLE.handoverLine}</strong>
                </span>
              </div>

              {/* Bottom-Right Zoom & Layer Controls */}
              <div className="stitch-radar-controls">
                <button
                  type="button"
                  className="stitch-map-ctrl-btn"
                  onClick={() => setRadarZoom((z) => Math.min(1.25, +(z + 0.1).toFixed(2)))}
                  aria-label="Zoom radar in"
                  title="Zoom in"
                >
                  +
                </button>
                <button
                  type="button"
                  className="stitch-map-ctrl-btn"
                  onClick={() => setRadarZoom((z) => Math.max(0.85, +(z - 0.1).toFixed(2)))}
                  aria-label="Zoom radar out"
                  title="Zoom out"
                >
                  -
                </button>
                <button
                  type="button"
                  className={`stitch-map-ctrl-btn${showRadarGrid ? ' active' : ''}`}
                  onClick={() => setShowRadarGrid((v) => !v)}
                  aria-label="Toggle sectional grid overlay"
                  title="Toggle grid overlay"
                >
                  <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <polygon points="10 3 17 7 10 11 3 7" />
                    <polyline points="3 11 10 15 17 11" />
                    <polyline points="3 14.5 10 18.5 17 14.5" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Bottom MFD Telemetry Strip */}
            <div className="stitch-mfd-footer tabular-num">
              <div className="stitch-mfd-footer-group">
                <span>
                  GEOMETRIC ACCURACY: <strong>{RADAR_TELEMETRY_SAMPLE.geometricAccuracy}</strong>
                </span>
                <span>
                  GRID DENSITY: <strong className="stitch-blue">{RADAR_TELEMETRY_SAMPLE.gridDensity}</strong>
                </span>
              </div>
              <div>
                CORRIDOR FREQUENCY: <strong>{RADAR_TELEMETRY_SAMPLE.corridorFrequency}</strong>
              </div>
            </div>
          </article>

          {/* Vertical Flight Corridor Cross-Section Card */}
          <article className="stitch-elevation-card">
            <div className="stitch-elevation-head">
              <div className="stitch-elevation-title-wrap">
                <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="var(--chart-blue)" strokeWidth="1.9" aria-hidden="true">
                  <path d="M2.5 15L8 7.5l3.5 4.2 3-3.7 3 7H2.5z" strokeLinejoin="round" />
                </svg>
                <h3>{RADAR_TELEMETRY_SAMPLE.elevationProfile.title}</h3>
              </div>
              <span className="stitch-ceiling-label">{RADAR_TELEMETRY_SAMPLE.elevationProfile.cruiseCeiling}</span>
            </div>

            <div className="stitch-elevation-chart">
              <svg className="stitch-elevation-svg" viewBox="0 0 700 92" preserveAspectRatio="none" aria-hidden="true">
                <defs>
                  <linearGradient id="terrainGradLight" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#DDD6C8" stopOpacity="0.82" />
                    <stop offset="100%" stopColor="#EBE8DF" stopOpacity="0.38" />
                  </linearGradient>
                </defs>
                <polygon
                  fill="url(#terrainGradLight)"
                  points="0,92 0,66 140,58 260,68 380,50 490,62 600,54 700,60 700,92"
                />
                <polyline
                  fill="none"
                  points="0,66 140,58 260,68 380,50 490,62 600,54 700,60"
                  stroke="#727782"
                  strokeWidth="1.5"
                />
                <polyline
                  fill="none"
                  points="12,66 74,22 618,22 688,60"
                  stroke="#2f6fba"
                  strokeDasharray="5 3"
                  strokeWidth="2.5"
                />
                <polyline
                  fill="none"
                  opacity="0.7"
                  points="0,48 140,40 260,50 380,32 490,44 600,36 700,42"
                  stroke="#c04600"
                  strokeDasharray="2 3"
                  strokeWidth="1.2"
                />
              </svg>

              <div className="stitch-clearance-badge tabular-num">
                {RADAR_TELEMETRY_SAMPLE.elevationProfile.clearanceLabel}
              </div>
              <div className="stitch-dep-label tabular-num">
                {RADAR_TELEMETRY_SAMPLE.elevationProfile.departureLabel}
              </div>
              <div className="stitch-arr-label tabular-num">
                {RADAR_TELEMETRY_SAMPLE.elevationProfile.arrivalLabel}
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
                REAL-TIME DOSSIER TELEMETRY ({filteredAudits.length} SITES)
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
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <line x1="3" y1="5.5" x2="17" y2="5.5" strokeLinecap="round" />
                  <line x1="5.5" y1="10" x2="14.5" y2="10" strokeLinecap="round" />
                  <line x1="8" y1="14.5" x2="12" y2="14.5" strokeLinecap="round" />
                </svg>
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
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <line x1="4" y1="6" x2="16" y2="6" strokeLinecap="round" />
                  <line x1="4" y1="10" x2="13" y2="10" strokeLinecap="round" />
                  <line x1="4" y1="14" x2="9.5" y2="14" strokeLinecap="round" />
                </svg>
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

          {loading ? (
            <div className="stitch-audit-stack">
              <AuditCardSkeleton />
              <AuditCardSkeleton />
              <AuditCardSkeleton />
            </div>
          ) : visibleAudits.length === 0 ? (
            <div className="stitch-empty-card">
              <div className="stitch-empty-title">No Matching Aerodromes in Current Filter</div>
              <p className="stitch-empty-desc">
                Adjust the global search query, sector region pill, or verdict filter to inspect regional airstrip audits.
              </p>
              <button type="button" className="stitch-retry-btn" onClick={resetAllFilters}>
                Reset Filters
              </button>
            </div>
          ) : (
            <>
              <div className="stitch-audit-stack">
                {visibleAudits.map((audit) => (
                  <article
                    key={audit.id}
                    className={`stitch-audit-card stitch-audit-${audit.verdict}`}
                  >
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
                        <span className="stitch-spec-k">{'RUNWAY'}</span>
                        <strong className="stitch-spec-v">{audit.runwayPrimary}</strong>
                        <span className="stitch-spec-sub">{audit.runwaySecondary}</span>
                      </div>
                      <div className="stitch-spec-cell">
                        <span className="stitch-spec-k">{audit.metric2Label}</span>
                        <strong
                          className={`stitch-spec-v ${
                            audit.verdict === 'viable'
                              ? 'stitch-blue'
                              : audit.verdict === 'conditional'
                                ? 'stitch-amber'
                                : 'stitch-red'
                          }`}
                        >
                          {audit.metric2Value}
                        </strong>
                        <span className="stitch-spec-sub">{audit.metric2Sub}</span>
                      </div>
                      <div className="stitch-spec-cell">
                        <span className="stitch-spec-k">{audit.metric3Label}</span>
                        <strong className="stitch-spec-v">{audit.metric3Value}</strong>
                        <span
                          className={`stitch-spec-sub ${
                            audit.verdict === 'viable'
                              ? 'stitch-green'
                              : audit.verdict === 'nonviable'
                                ? 'stitch-red'
                                : ''
                          }`}
                        >
                          {audit.metric3Sub}
                        </span>
                      </div>
                    </div>

                    <div className={`stitch-assessment-line stitch-assess-${audit.verdict}`}>
                      {audit.verdict === 'viable' && (
                        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <circle cx="10" cy="10" r="7.5" />
                          <polyline points="6.8 10.3 9 12.5 13.4 7.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                      {audit.verdict === 'conditional' && (
                        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <circle cx="10" cy="10" r="7.5" />
                          <line x1="10" y1="9" x2="10" y2="13.5" strokeLinecap="round" />
                          <circle cx="10" cy="6.6" r="0.8" fill="currentColor" />
                        </svg>
                      )}
                      {audit.verdict === 'nonviable' && (
                        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <circle cx="10" cy="10" r="7.5" />
                          <line x1="7.5" y1="7.5" x2="12.5" y2="12.5" strokeLinecap="round" />
                          <line x1="12.5" y1="7.5" x2="7.5" y2="12.5" strokeLinecap="round" />
                        </svg>
                      )}
                      <span>{audit.assessment}</span>
                    </div>

                    <div className="stitch-audit-footer">
                      <span className="stitch-audit-caveat">
                        Decision-support estimate. Verify with a site survey before committing.
                      </span>
                      <button
                        type="button"
                        className="stitch-dossier-btn"
                        onClick={() => navigate(`/map?strip=${audit.id}`)}
                      >
                        <span>View Dossier</span>
                        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <line x1="4" y1="10" x2="15.5" y2="10" strokeLinecap="round" />
                          <polyline points="11 5.5 15.8 10 11 14.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
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

      {/* 4. Bottom Mission Corridoring & Dispatch Console */}
      <section className="stitch-console-banner" aria-label="Mission Corridoring Console">
        <div className="stitch-console-left">
          <div className="stitch-corridor-block">
            <div className="stitch-corridor-icon" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M2.5 14.5h15" strokeLinecap="round" />
                <path d="M4.5 11.5l3.2-2.2 2.4-4.8 1.6 1.2-1 3.6 3.8-1.4 2 1.2-6.2 3.3-5.8-.9z" />
              </svg>
            </div>
            <div>
              <div className="stitch-console-kicker">MISSION CORRIDORING</div>
              <div className="stitch-corridor-route">
                <strong>{RADAR_TELEMETRY_SAMPLE.missionCorridor.origin}</strong>
                <span className="stitch-blue" aria-hidden="true">➔</span>
                <strong>{RADAR_TELEMETRY_SAMPLE.missionCorridor.destination}</strong>
              </div>
              <div className="stitch-corridor-meta">{RADAR_TELEMETRY_SAMPLE.missionCorridor.sectorMeta}</div>
            </div>
          </div>

          <div className="stitch-airframe-block">
            <div className="stitch-console-kicker">ACTIVE AIRFRAME SIMULATION</div>
            <div className="stitch-airframe-tabs" role="tablist" aria-label="Active Airframe">
              {AIRFRAME_PRESETS.map((airframe) => {
                const isSelected = airframe.id === activeAirframeId
                return (
                  <button
                    key={airframe.id}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    className={`stitch-airframe-tab${isSelected ? ' active' : ''}`}
                    onClick={() => setActiveAirframeId(airframe.id)}
                  >
                    {isSelected && <span className="stitch-pill-dot" style={{ backgroundColor: '#2F6FBA' }} aria-hidden="true" />}
                    <span>{airframe.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="stitch-console-actions">
          <button type="button" className="stitch-export-btn" onClick={handleExportCsv}>
            <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <circle cx="10" cy="10" r="7.5" />
              <line x1="10" y1="6.5" x2="10" y2="12.5" strokeLinecap="round" />
              <polyline points="7.5 10.5 10 13 12.5 10.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Export Sectional Dossier (PDF/CSV)</span>
          </button>

          <button type="button" className="stitch-primary-cta" onClick={() => navigate('/map')}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
              <path d="M12.5 3.5c2.2 0 4 1.8 4 4 0 3.2-3.5 6.8-6.8 6.8-.9 0-1.8-.3-2.5-.8l-3.4.8.8-3.4c-.5-.7-.8-1.6-.8-2.5 0-3.3 3.6-6.9 6.7-4.9z" />
              <circle cx="12" cy="8" r="1.2" fill="currentColor" />
            </svg>
            <span>Simulate Fleet Route &amp; Vertical Profile →</span>
          </button>
        </div>
      </section>
    </div>
  )
}
