import { useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, CircleMarker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import {
  MOCK_AIRSTRIPS,
  getAirstripAccessPoints,
  getAirstripNearbyAirports,
  getDefaultAssetsForAirstrip,
} from '../data/mockData'
import { ALL_CAPITALS } from '../data/indiaGeo'
import { useAuth } from '../context/AuthContext'

const TILE_LAYERS = {
  dark: {
    label: 'Dark Slate',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri, DeLorme, NAVTEQ',
    maxNativeZoom: 16,
    maxZoom: 20,
  },
  topo: {
    label: 'Topo Chart',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri, DeLorme, NAVTEQ, TomTom',
    maxNativeZoom: 17,
    maxZoom: 20,
  },
  light: {
    label: 'Light Chart',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri, DeLorme, NAVTEQ',
    maxNativeZoom: 16,
    maxZoom: 20,
  },
}

const SURFACE_OPTIONS = ['all', 'asphalt', 'concrete', 'gravel', 'grass']
const OWNERSHIP_OPTIONS = ['all', 'state', 'private', 'municipal', 'central']
const RUNWAY_OPTIONS = [
  { label: 'Any', value: 0 },
  { label: '800m+', value: 800 },
  { label: '1200m+', value: 1200 },
  { label: '1800m+', value: 1800 },
]

function getTierKey(score) {
  if (score >= 70) return 'high'
  if (score >= 40) return 'moderate'
  return 'low'
}

function getTierLabel(score) {
  if (score >= 70) return 'High Viability'
  if (score >= 40) return 'Moderate Viability'
  return 'Low Viability'
}

function createAviationMarkerIcon(feature, isSelected) {
  const prop = feature.properties
  const score = prop.feasibility?.score ?? 0
  const tier = getTierKey(score)
  const surface = (prop.surface || 'asphalt').toLowerCase()
  const isPaved = surface === 'asphalt' || surface === 'concrete'
  const hasPoliticalAlert = (prop.political_influence?.penalty_points || 0) > 0
  const sev = prop.political_influence?.severity || 'none'

  const shapeClass = isPaved ? 'marker-strip' : 'marker-diamond'
  const selectedClass = isSelected ? ' marker-selected' : ''
  const alertPip = hasPoliticalAlert
    ? `<span class="marker-risk-pip risk-${sev}" title="Political risk penalty"></span>`
    : ''

  if (isPaved) {
    return L.divIcon({
      className: 'custom-pinpoint-marker',
      html: `<div class="marker-shell ${shapeClass} tier-${tier}${selectedClass}"><span class="strip-tick"></span><span class="marker-score">${score}</span><span class="strip-tick"></span>${alertPip}</div>`,
      iconSize: [44, 24],
      iconAnchor: [22, 12],
      popupAnchor: [0, -14],
    })
  }

  return L.divIcon({
    className: 'custom-pinpoint-marker',
    html: `<div class="marker-shell ${shapeClass} tier-${tier}${selectedClass}"><span class="diamond-inner">${score}</span>${alertPip}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -16],
  })
}

function MapFlyController({ selectedFeature }) {
  const map = useMap()
  useEffect(() => {
    if (!selectedFeature?.geometry?.coordinates) return
    const [lon, lat] = selectedFeature.geometry.coordinates
    const targetZoom = Math.max(map.getZoom(), 7)
    map.flyTo([lat, lon], targetZoom, { duration: 0.45 })
  }, [selectedFeature, map])
  return null
}

function getAircraftClearance(prop) {
  const len = Number(prop?.runway_length_m) || 0
  const surf = (prop?.surface || '').toLowerCase()
  const paved = surf === 'asphalt' || surf === 'concrete'
  return [
    { label: 'eVTOL', minReq: '60m+', cleared: len >= 60 },
    { label: 'STOL', minReq: '600m+', cleared: len >= 600 },
    { label: 'Turboprop', minReq: '1200m Paved', cleared: len >= 1200 && paved },
  ]
}

export default function AirstripsMap() {
  const { currentUser, token } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const searchInputRef = useRef(null)

  const [airstrips, setAirstrips] = useState([])
  const [loading, setLoading] = useState(true)
  const [dataSource, setDataSource] = useState('checking') // 'live' | 'cache' | 'checking'
  const [selectedAirstrip, setSelectedAirstrip] = useState(null)
  const [basemap, setBasemap] = useState('dark')
  const [showCapitals, setShowCapitals] = useState(false)

  const [filters, setFilters] = useState({
    query: '',
    surface: 'all',
    ownership: 'all',
    minRunway: 0,
    viability: 'all',
    political: 'all',
  })

  // Assets state per selected airstrip
  const [assets, setAssets] = useState([])
  const [assetsLoading, setAssetsLoading] = useState(false)
  const [showAssetForm, setShowAssetForm] = useState(false)
  const [assetForm, setAssetForm] = useState({
    name: '',
    asset_type: 'charging_station',
    status: 'operational',
    quantity: 1,
    capacity_spec: '',
  })

  const canModifyAssets = currentUser?.role === 'admin' || currentUser?.role === 'analyst'

  async function loadAirstrips(signal) {
    setLoading(true)
    try {
      const res = await fetch('/api/airstrips', { signal })
      if (!res.ok) throw new Error('API unavailable')
      const json = await res.json()
      const features = json.features ?? json
      if (Array.isArray(features) && features.length > 0) {
        setAirstrips(features)
        setDataSource('live')
      } else {
        setAirstrips(MOCK_AIRSTRIPS)
        setDataSource('cache')
      }
    } catch (err) {
      if (err.name === 'AbortError') return
      setAirstrips(MOCK_AIRSTRIPS)
      setDataSource('cache')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    loadAirstrips(controller.signal)
    return () => controller.abort()
  }, [])

  // Pre-select airstrip from ?strip=<id> URL param when arriving from Overview
  useEffect(() => {
    const stripParam = searchParams.get('strip')
    if (!stripParam || airstrips.length === 0) return
    const match = airstrips.find((f) => String(f.properties.id) === String(stripParam))
    if (match) {
      setSelectedAirstrip(match)
    }
  }, [searchParams, airstrips])

  // Keyboard shortcuts: `/` focuses search, `Escape` closes detail panel
  useEffect(() => {
    function onKeyDown(e) {
      const tag = document.activeElement?.tagName?.toLowerCase()
      if (e.key === '/' && tag !== 'input' && tag !== 'textarea' && tag !== 'select') {
        e.preventDefault()
        searchInputRef.current?.focus()
      } else if (e.key === 'Escape' && selectedAirstrip) {
        setSelectedAirstrip(null)
        setSearchParams({})
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedAirstrip, setSearchParams])

  // Fetch on-site assets when selected airstrip changes
  useEffect(() => {
    if (!selectedAirstrip?.properties?.id) {
      setAssets([])
      setShowAssetForm(false)
      return
    }
    const prop = selectedAirstrip.properties
    const fallbackAssets = getDefaultAssetsForAirstrip(prop)
    const controller = new AbortController()
    setAssetsLoading(true)
    setShowAssetForm(false)

    fetch(`/api/airstrips/${prop.id}/assets`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.assets && json.assets.length > 0) {
          setAssets(json.assets)
        } else {
          setAssets(fallbackAssets)
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setAssets(fallbackAssets)
      })
      .finally(() => setAssetsLoading(false))

    return () => controller.abort()
  }, [selectedAirstrip])

  const filtered = useMemo(() => {
    const q = filters.query.trim().toLowerCase()
    return airstrips.filter((f) => {
      const prop = f.properties
      const score = prop.feasibility?.score ?? 0
      const polSev = prop.political_influence?.severity || 'none'
      const surf = (prop.surface || '').toLowerCase()
      const own = (prop.ownership || '').toLowerCase()
      const runwayLen = Number(prop.runway_length_m) || 0

      if (q) {
        const hay = `${prop.name} ${prop.state} ${prop.nearest_airport?.code || ''} ${prop.nearest_airport?.name || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (filters.surface !== 'all' && surf !== filters.surface) return false
      if (filters.ownership !== 'all' && own !== filters.ownership) return false
      if (filters.minRunway > 0 && runwayLen < filters.minRunway) return false
      if (filters.viability === 'high' && score < 70) return false
      if (filters.viability === 'moderate' && (score < 40 || score >= 70)) return false
      if (filters.viability === 'low' && score >= 40) return false
      if (filters.political !== 'all' && polSev !== filters.political) return false
      return true
    })
  }, [airstrips, filters])

  const avgFilteredRunway = useMemo(() => {
    if (filtered.length === 0) return 0
    const sum = filtered.reduce((acc, f) => acc + (Number(f.properties.runway_length_m) || 0), 0)
    return Math.round(sum / filtered.length)
  }, [filtered])

  const hasActiveFilters =
    filters.query.trim() !== '' ||
    filters.surface !== 'all' ||
    filters.ownership !== 'all' ||
    filters.minRunway > 0 ||
    filters.viability !== 'all' ||
    filters.political !== 'all'

  function resetFilters() {
    setFilters({
      query: '',
      surface: 'all',
      ownership: 'all',
      minRunway: 0,
      viability: 'all',
      political: 'all',
    })
  }

  function handleSelectAirstrip(feature) {
    setSelectedAirstrip(feature)
    setSearchParams({ strip: String(feature.properties.id) })
  }

  async function handleCreateAsset(e) {
    e.preventDefault()
    if (!assetForm.name.trim() || !selectedAirstrip) return
    const stripId = selectedAirstrip.properties.id
    const payload = {
      name: assetForm.name.trim(),
      asset_type: assetForm.asset_type,
      status: assetForm.status,
      condition_grade: 'good',
      quantity: Math.max(1, Number(assetForm.quantity) || 1),
      capacity_spec: assetForm.capacity_spec.trim() || undefined,
    }

    let created = null
    if (token) {
      try {
        const res = await fetch(`/api/airstrips/${stripId}/assets`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        })
        if (res.ok) {
          const data = await res.json()
          created = data.asset
        }
      } catch {
        // Fallback to local session state
      }
    }

    if (!created) {
      created = {
        id: Date.now(),
        airstrip_id: stripId,
        ...payload,
        capacity_spec: payload.capacity_spec || 'Workstation logged',
      }
    }

    setAssets((prev) => [...prev, created])
    setAssetForm({ name: '', asset_type: 'charging_station', status: 'operational', quantity: 1, capacity_spec: '' })
    setShowAssetForm(false)
  }

  const p = selectedAirstrip?.properties
  const coords = selectedAirstrip?.geometry?.coordinates
  const activeTile = TILE_LAYERS[basemap] || TILE_LAYERS.dark
  const selectedScore = p?.feasibility?.score ?? 0
  const selectedTier = getTierKey(selectedScore)
  const accessPoints = useMemo(() => (p ? getAirstripAccessPoints(p) : []), [p])
  const nearbyAirports = useMemo(() => (p ? getAirstripNearbyAirports(p, coords) : []), [p, coords])
  const clearances = useMemo(() => (p ? getAircraftClearance(p) : []), [p])

  return (
    <div className={`map-page${basemap === 'light' ? ' light-mode-map' : ''}`}>
      {/* Docked Flight-Ops Filter Console */}
      <header className="map-header" aria-label="Sector Search and Filter Controls">
        <div className="map-top-row">
          <div className="map-title-cluster">
            <h1 className="map-console-title">Sector Feasibility Map</h1>
            <span className={`telemetry-badge ${dataSource === 'live' ? 'telemetry-live' : 'telemetry-cache'}`}>
              {dataSource === 'live'
                ? 'Live PostGIS Connected'
                : dataSource === 'cache'
                ? `Offline Sector Cache (${airstrips.length} Strips)`
                : 'Synchronizing Telemetry...'}
            </span>
          </div>

          <div className="map-search-controls">
            <div className="search-input-wrap">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="search-icon" aria-hidden="true">
                <circle cx="7" cy="7" r="5" />
                <line x1="11" y1="11" x2="14.5" y2="14.5" />
              </svg>
              <input
                ref={searchInputRef}
                type="search"
                className="ops-search-input"
                value={filters.query}
                onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
                placeholder="Filter by airstrip, state, or hub IATA (press /)"
                aria-label="Search airstrips by name, state, or nearest airport code"
              />
            </div>

            <div className="segmented-group" role="group" aria-label="Basemap Chart Mode">
              {Object.entries(TILE_LAYERS).map(([key, cfg]) => (
                <button
                  key={key}
                  type="button"
                  className={`seg-btn${basemap === key ? ' active' : ''}`}
                  onClick={() => setBasemap(key)}
                >
                  {cfg.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              className={`seg-btn${showCapitals ? ' active' : ''}`}
              onClick={() => setShowCapitals((v) => !v)}
              title="Toggle State and Union Territory capital beacons"
            >
              Capitals ({ALL_CAPITALS.length})
            </button>
          </div>
        </div>

        {/* Instrument Filter Strip */}
        <div className="map-filter-strip">
          <div className="filter-cluster">
            <span className="filter-cluster-label">Surface</span>
            <div className="segmented-group" role="group" aria-label="Filter by runway surface">
              {SURFACE_OPTIONS.map((surf) => (
                <button
                  key={surf}
                  type="button"
                  className={`seg-btn${filters.surface === surf ? ' active' : ''}`}
                  onClick={() => setFilters((f) => ({ ...f, surface: surf }))}
                >
                  {surf === 'all' ? 'All' : surf.charAt(0).toUpperCase() + surf.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-cluster">
            <span className="filter-cluster-label">Ownership</span>
            <div className="segmented-group" role="group" aria-label="Filter by ownership">
              {OWNERSHIP_OPTIONS.map((own) => (
                <button
                  key={own}
                  type="button"
                  className={`seg-btn${filters.ownership === own ? ' active' : ''}`}
                  onClick={() => setFilters((f) => ({ ...f, ownership: own }))}
                >
                  {own === 'all' ? 'All' : own.charAt(0).toUpperCase() + own.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-cluster">
            <span className="filter-cluster-label">Runway</span>
            <div className="segmented-group" role="group" aria-label="Filter by minimum runway length">
              {RUNWAY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`seg-btn${filters.minRunway === opt.value ? ' active' : ''}`}
                  onClick={() => setFilters((f) => ({ ...f, minRunway: opt.value }))}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-cluster">
            <select
              className="filter-select"
              value={filters.viability}
              onChange={(e) => setFilters((f) => ({ ...f, viability: e.target.value }))}
              aria-label="Filter by feasibility tier"
            >
              <option value="all">Viability: All</option>
              <option value="high">High (70+)</option>
              <option value="moderate">Moderate (40-69)</option>
              <option value="low">Low (&lt;40)</option>
            </select>

            <select
              className="filter-select"
              value={filters.political}
              onChange={(e) => setFilters((f) => ({ ...f, political: e.target.value }))}
              aria-label="Filter by political disruption severity"
            >
              <option value="all">Political Risk: All</option>
              <option value="none">Zero Disruption</option>
              <option value="low">Low (-5 pts)</option>
              <option value="moderate">Moderate (-15 pts)</option>
              <option value="high">High (-28 pts)</option>
            </select>

            {hasActiveFilters && (
              <button type="button" className="btn btn-outlined reset-btn" onClick={resetFilters}>
                Reset
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Primary Instrument Canvas + Readout Bay */}
      <div className="map-body">
        <div className="map-container">
          {loading && (
            <div className="map-state-overlay" role="status" aria-live="polite">
              <div className="map-state-box">
                <div className="radar-sweep-bar" />
                <div className="map-state-title">Synchronizing Sector Telemetry</div>
                <div className="map-state-desc">
                  Querying PostGIS SRID 4326 geometry vectors and computing runway feasibility scores across regional micro-airstrips.
                </div>
              </div>
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="map-state-overlay" role="status">
              <div className="map-state-box">
                <div className="map-state-title">0 Airstrips Match Active Sector Constraints</div>
                <div className="map-state-desc">
                  No indexed airstrips satisfy the current runway length, surface type, ownership, or political risk filters.
                </div>
                <button type="button" className="btn btn-primary" onClick={resetFilters}>
                  Reset Sector Filters
                </button>
              </div>
            </div>
          )}

          <MapContainer
            center={[20.5937, 78.9629]}
            zoom={5}
            style={{ height: '100%', width: '100%' }}
            zoomControl={true}
          >
            <TileLayer
              key={basemap}
              url={activeTile.url}
              attribution={activeTile.attribution}
              maxNativeZoom={activeTile.maxNativeZoom}
              maxZoom={activeTile.maxZoom}
            />
            <MapFlyController selectedFeature={selectedAirstrip} />

            {filtered.map((f) => {
              const prop = f.properties
              const [lng, lat] = f.geometry.coordinates
              const score = prop.feasibility?.score ?? 0
              const isSelected = selectedAirstrip?.properties?.id === prop.id
              const icon = createAviationMarkerIcon(f, isSelected)

              return (
                <Marker
                  key={prop.id}
                  position={[lat, lng]}
                  icon={icon}
                  eventHandlers={{
                    click: () => handleSelectAirstrip(f),
                  }}
                >
                  <Popup>
                    <div className="popup-name">{prop.name}</div>
                    <div className="popup-row">
                      <span>Jurisdiction</span>
                      <span>{prop.state}</span>
                    </div>
                    <div className="popup-row">
                      <span>Runway</span>
                      <span className="tabular-num">{prop.runway_length_m}m {prop.surface}</span>
                    </div>
                    <div className="popup-row">
                      <span>Feasibility</span>
                      <strong className={`tabular-num tier-text-${getTierKey(score)}`}>
                        {score}/100 ({getTierLabel(score)})
                      </strong>
                    </div>
                    <div className="popup-click-hint">Open Flight-Data Readout in right bay</div>
                  </Popup>
                </Marker>
              )
            })}

            {showCapitals &&
              ALL_CAPITALS.map((cap) => {
                const [lng, lat] = cap.coordinates
                return (
                  <CircleMarker
                    key={cap.state}
                    center={[lat, lng]}
                    radius={4.5}
                    pathOptions={{
                      color: '#0EA5E9',
                      fillColor: '#0EA5E9',
                      fillOpacity: 0.75,
                      weight: 1.5,
                    }}
                  >
                    <Popup>
                      <div className="popup-name">{cap.capital}</div>
                      <div className="popup-row">
                        <span>Jurisdiction</span>
                        <span>{cap.state}</span>
                      </div>
                      <div className="popup-row">
                        <span>Type</span>
                        <span>{cap.type} Capital</span>
                      </div>
                      <div className="popup-row">
                        <span>WGS-84</span>
                        <span className="tabular-num">{lat.toFixed(3)}N, {lng.toFixed(3)}E</span>
                      </div>
                    </Popup>
                  </CircleMarker>
                )
              })}
          </MapContainer>
        </div>

        {/* Right-hand Flight-Data Readout Bay */}
        <aside
          className={`map-detail-panel${selectedAirstrip ? ' panel-active' : ''}`}
          aria-label="Airstrip Flight-Data Readout"
        >
          {!selectedAirstrip ? (
            <div className="empty-detail">
              <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" className="empty-reticle" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <line x1="12" y1="2" x2="12" y2="7" />
                <line x1="12" y1="17" x2="12" y2="22" />
                <line x1="2" y1="12" x2="7" y2="12" />
                <line x1="17" y1="12" x2="22" y2="12" />
              </svg>
              <div className="empty-detail-title">No Target Selected</div>
              <div className="empty-detail-desc">
                Select any paved runway strip or unpaved survey beacon on the map to inspect runway geometry, last-mile ground access, commercial hubs, on-site assets, and political stability.
              </div>
              <div className="empty-legend-box">
                <div className="legend-row">
                  <span className="legend-sample-strip" />
                  <span>Paved Strip (Asphalt / Concrete)</span>
                </div>
                <div className="legend-row">
                  <span className="legend-sample-diamond" />
                  <span>Unpaved Beacon (Gravel / Grass)</span>
                </div>
                <div className="legend-row">
                  <span className="legend-sample-pip" />
                  <span>Active Political Disruption Penalty</span>
                </div>
              </div>
            </div>
          ) : (
            <div className={`readout-scroll strip-accent-${selectedTier}`}>
              {/* 1. Identity Header */}
              <div className="readout-header">
                <div>
                  <h2 className="readout-title">{p.name}</h2>
                  <div className="readout-meta-grid">
                    <span>{p.state}</span>
                    <span className="meta-divider">|</span>
                    <span className="capitalize">{p.ownership} Ownership</span>
                    <span className="meta-divider">|</span>
                    <span className="tabular-num">
                      {coords ? `${coords[1].toFixed(4)}N, ${coords[0].toFixed(4)}E` : 'Coordinates N/A'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="close-btn"
                  onClick={() => {
                    setSelectedAirstrip(null)
                    setSearchParams({})
                  }}
                  aria-label="Close airstrip readout panel"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75">
                    <line x1="3.5" y1="3.5" x2="12.5" y2="12.5" />
                    <line x1="12.5" y1="3.5" x2="3.5" y2="12.5" />
                  </svg>
                </button>
              </div>

              {/* 2. Immediate Feasibility Verdict & Aircraft Clearances */}
              <section className="readout-section verdict-section">
                <div className="verdict-top-row">
                  <div className="verdict-score-cluster">
                    <span className={`verdict-score tabular-num tier-text-${selectedTier}`}>
                      {selectedScore}
                    </span>
                    <span className="verdict-denom tabular-num">/ 100</span>
                  </div>
                  <div className="verdict-status-stack">
                    <span className={`clearance-tag tag-${selectedTier}`}>
                      {getTierLabel(selectedScore)}
                    </span>
                    <div className="verdict-delta tabular-num">
                      Base {p.feasibility?.base_score ?? selectedScore} | Political{' '}
                      {(p.political_influence?.penalty_points || 0) > 0
                        ? `-${p.political_influence.penalty_points}`
                        : '0'}{' '}
                      pts
                    </div>
                  </div>
                </div>

                {/* Aircraft Class Clearance Matrix */}
                <div className="clearance-matrix">
                  {clearances.map((c) => (
                    <div key={c.label} className={`clearance-cell ${c.cleared ? 'cell-cleared' : 'cell-restricted'}`}>
                      <span className="clearance-class">{c.label}</span>
                      <span className="clearance-req">{c.minReq}</span>
                      <span className="clearance-state">{c.cleared ? 'CLEARED' : 'RESTRICTED'}</span>
                    </div>
                  ))}
                </div>

                {/* 4-Factor Score Breakdown */}
                {p.feasibility?.breakdown && (
                  <div className="breakdown-grid">
                    {[
                      ['Runway', p.feasibility.breakdown.runway, 25],
                      ['Surface', p.feasibility.breakdown.surface, 20],
                      ['Utilities', p.feasibility.breakdown.utilities, 30],
                      ['Hub Link', p.feasibility.breakdown.connectivity, 25],
                    ].map(([label, val, max]) => (
                      <div key={label} className="breakdown-cell">
                        <div className="breakdown-cell-head">
                          <span>{label}</span>
                          <span className="tabular-num">{val ?? 0}/{max}</span>
                        </div>
                        <div className="breakdown-track">
                          <div
                            className="breakdown-fill"
                            style={{ width: `${Math.min(100, Math.round(((val || 0) / max) * 100))}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* 3. Runway Strip Schematic & Utilities */}
              <section className="readout-section">
                <h3 className="readout-section-title">Runway Geometry &amp; Ground Utilities</h3>
                <div className="runway-schematic-box" aria-label={`Runway ${p.runway_length_m} meters by ${p.runway_width_m} meters`}>
                  <svg viewBox="0 0 360 48" width="100%" height="48">
                    <rect x="4" y="6" width="352" height="36" fill="#0B121E" stroke="#2B4162" strokeWidth="1" />
                    <line x1="12" y1="12" x2="12" y2="36" stroke="#8A9BB5" strokeWidth="2" />
                    <line x1="348" y1="12" x2="348" y2="36" stroke="#8A9BB5" strokeWidth="2" />
                    <text x="20" y="28" fill="#8A9BB5" fontSize="10" fontWeight="600">09</text>
                    <line x1="42" y1="24" x2="112" y2="24" stroke="#0EA5E9" strokeWidth="1.5" strokeDasharray="6 5" />
                    <rect x="118" y="13" width="124" height="22" fill="#162236" stroke="#1E2E46" strokeWidth="1" />
                    <text x="180" y="28" textAnchor="middle" fill="#EAF0F8" fontSize="11" fontWeight="600">
                      {p.runway_length_m?.toLocaleString()}m x {p.runway_width_m || 25}m
                    </text>
                    <line x1="248" y1="24" x2="318" y2="24" stroke="#0EA5E9" strokeWidth="1.5" strokeDasharray="6 5" />
                    <text x="340" y="28" textAnchor="end" fill="#8A9BB5" fontSize="10" fontWeight="600">27</text>
                  </svg>
                </div>

                <div className="spec-kv-grid">
                  <div className="spec-kv">
                    <span className="spec-k">Surface</span>
                    <span className="spec-v capitalize">{p.surface}</span>
                  </div>
                  <div className="spec-kv">
                    <span className="spec-k">Elevation</span>
                    <span className="spec-v tabular-num">{p.elevation_m}m ASL</span>
                  </div>
                  <div className="spec-kv">
                    <span className="spec-k">Night Lights</span>
                    <span className={`spec-v ${p.night_landing ? 'val-ok' : 'val-muted'}`}>
                      {p.night_landing ? 'Operational' : 'Day VFR Only'}
                    </span>
                  </div>
                  <div className="spec-kv">
                    <span className="spec-k">Aviation Fuel</span>
                    <span className={`spec-v ${p.fuel_available ? 'val-ok' : 'val-muted'}`}>
                      {p.fuel_available ? 'Available' : 'None'}
                    </span>
                  </div>
                  <div className="spec-kv">
                    <span className="spec-k">eVTOL Charge</span>
                    <span className={`spec-v ${p.charging_available ? 'val-ok' : 'val-muted'}`}>
                      {p.charging_available ? 'DC Ready' : 'Not Installed'}
                    </span>
                  </div>
                  <div className="spec-kv">
                    <span className="spec-k">Ownership</span>
                    <span className="spec-v capitalize">{p.ownership}</span>
                  </div>
                </div>
              </section>

              {/* 4. Political & Regulatory Stability */}
              {p.political_influence && (
                <section
                  className={`readout-section${
                    p.political_influence.has_influence ? ` pol-alert-${p.political_influence.severity}` : ''
                  }`}
                >
                  <div className="readout-section-head">
                    <h3 className="readout-section-title">Political &amp; Regulatory Stability</h3>
                    <span className={`pol-badge pol-${p.political_influence.severity || 'none'}`}>
                      {(p.political_influence.severity || 'none').toUpperCase()} |{' '}
                      {p.political_influence.penalty_points > 0
                        ? `-${p.political_influence.penalty_points} pts`
                        : '0 pts'}
                    </span>
                  </div>
                  <div className="pol-disruption-title">{p.political_influence.disruption_type}</div>
                  <p className="pol-details-text">{p.political_influence.details}</p>
                </section>
              )}

              {/* 5. Last-Mile Ground Access Points */}
              <section className="readout-section">
                <div className="readout-section-head">
                  <h3 className="readout-section-title">Last-Mile Access Points</h3>
                  <span className="section-count tabular-num">{accessPoints.length} Links</span>
                </div>
                <div className="readout-list">
                  {accessPoints.map((ap, i) => (
                    <div key={`${ap.name}-${i}`} className="readout-list-row">
                      <div className="readout-list-main">
                        <span className="access-type-tag">{ap.access_type.replace('_', ' ')}</span>
                        <span className="readout-list-name">{ap.name}</span>
                      </div>
                      <div className="readout-list-metrics tabular-num">
                        <span>{ap.distance_km} km</span>
                        <span className="metric-sub">{ap.drive_time_mins} min</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* 6. Nearby Commercial Hub Airports */}
              <section className="readout-section">
                <div className="readout-section-head">
                  <h3 className="readout-section-title">Nearby Hub Airports</h3>
                  <span className="section-count tabular-num">{nearbyAirports.length} Hubs</span>
                </div>
                <div className="readout-list">
                  {nearbyAirports.map((hub) => (
                    <div key={hub.code} className="readout-list-row">
                      <div className="readout-list-main">
                        <span className={`iata-badge${hub.is_nearest ? ' iata-primary' : ''}`}>{hub.code}</span>
                        <span className="readout-list-name">{hub.name}</span>
                      </div>
                      <div className="readout-list-metrics tabular-num">
                        <span>{hub.distance_km} km</span>
                        <span className="metric-sub">~{hub.evtol_mins}m eVTOL</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* 7. On-Site Assets Inventory */}
              <section className="readout-section">
                <div className="readout-section-head">
                  <h3 className="readout-section-title">On-Site Infrastructure Assets</h3>
                  {canModifyAssets ? (
                    <button
                      type="button"
                      className="inline-action-btn"
                      onClick={() => setShowAssetForm((v) => !v)}
                    >
                      {showAssetForm ? 'Cancel' : '+ Log Asset'}
                    </button>
                  ) : (
                    <span className="readonly-note">Viewer Read-Only</span>
                  )}
                </div>

                {showAssetForm && canModifyAssets && (
                  <form onSubmit={handleCreateAsset} className="inline-asset-form">
                    <input
                      type="text"
                      className="ops-input"
                      placeholder="Asset name (e.g., 350kW Charger Pad)"
                      value={assetForm.name}
                      onChange={(e) => setAssetForm((f) => ({ ...f, name: e.target.value }))}
                      required
                    />
                    <div className="inline-asset-row">
                      <select
                        className="ops-input"
                        value={assetForm.asset_type}
                        onChange={(e) => setAssetForm((f) => ({ ...f, asset_type: e.target.value }))}
                      >
                        <option value="charging_station">Charging Station</option>
                        <option value="hangar">Hangar</option>
                        <option value="fuel_point">Fuel Point</option>
                        <option value="lighting">Runway Lighting</option>
                        <option value="terminal">Passenger Terminal</option>
                        <option value="weather_station">Weather Station</option>
                      </select>
                      <input
                        type="number"
                        min="1"
                        className="ops-input qty-input"
                        value={assetForm.quantity}
                        onChange={(e) => setAssetForm((f) => ({ ...f, quantity: e.target.value }))}
                        aria-label="Asset quantity"
                      />
                    </div>
                    <input
                      type="text"
                      className="ops-input"
                      placeholder="Capacity / Spec (optional)"
                      value={assetForm.capacity_spec}
                      onChange={(e) => setAssetForm((f) => ({ ...f, capacity_spec: e.target.value }))}
                    />
                    <button type="submit" className="btn btn-primary">
                      Save Asset Record
                    </button>
                  </form>
                )}

                {assetsLoading ? (
                  <div className="asset-empty-note">Retrieving airstrip asset manifest...</div>
                ) : assets.length === 0 ? (
                  <div className="asset-empty-note">
                    No dedicated ground assets logged for this airstrip.
                  </div>
                ) : (
                  <div className="readout-list">
                    {assets.map((asset) => (
                      <div key={asset.id} className="readout-list-row">
                        <div className="readout-list-main">
                          <span className={`asset-dot status-${asset.status || 'operational'}`} />
                          <div>
                            <div className="readout-list-name">{asset.name}</div>
                            <div className="asset-subspec">
                              {asset.asset_type.replace('_', ' ')} | {asset.capacity_spec || 'Standard bay'}
                            </div>
                          </div>
                        </div>
                        <div className="readout-list-metrics tabular-num">
                          <span className="asset-status-label">{(asset.status || 'operational').replace('_', ' ')}</span>
                          <span className="metric-sub">Qty {asset.quantity || 1}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* 8. Technical Assessment Notes */}
              {p.feasibility?.reasons?.length > 0 && (
                <section className="readout-section">
                  <h3 className="readout-section-title">Engineering &amp; Dispatch Notes</h3>
                  <ul className="reasons-list">
                    {p.feasibility.reasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}
        </aside>
      </div>

      {/* Bottom WGS-84 Datum & Instrument Legend Bar */}
      <footer className="map-telemetry-bar">
        <div className="telemetry-left">
          <span className="datum-chip">WGS-84 / EPSG:4326</span>
          <span className="tabular-num">
            {filtered.length}/{airstrips.length} Airstrips
          </span>
          <span className="meta-divider">|</span>
          <span className="tabular-num">Avg Runway {avgFilteredRunway}m</span>
          {selectedAirstrip && (
            <>
              <span className="meta-divider">|</span>
              <span className="active-target-readout tabular-num">
                Active: {p.name} ({coords[1].toFixed(3)}N, {coords[0].toFixed(3)}E)
              </span>
            </>
          )}
        </div>

        <div className="telemetry-legend">
          <span className="legend-item">
            <span className="legend-dot dot-high" /> High (70+)
          </span>
          <span className="legend-item">
            <span className="legend-dot dot-moderate" /> Moderate (40-69)
          </span>
          <span className="legend-item">
            <span className="legend-dot dot-low" /> Low (&lt;40)
          </span>
          <span className="legend-item">
            <span className="legend-sample-strip" /> Paved
          </span>
          <span className="legend-item">
            <span className="legend-sample-diamond" /> Unpaved
          </span>
        </div>
      </footer>
    </div>
  )
}
