import { useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import { ALL_CAPITALS } from '../data/indiaGeo'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../theme/ThemeContext'
import DataSourceBadge from '../components/DataSourceBadge'
import {
  listAirstrips,
  listAircraft,
  evaluateAirstrip,
  listAirstripAssets,
  createAirstripAsset,
  useApi,
} from '../api'

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

function ClusteredAirstrips({ airstrips, selectedAirstrip, onSelectAirstrip }) {
  const map = useMap()
  const clusterGroupRef = useRef(null)

  useEffect(() => {
    if (!map) return
    const cluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 40,
      spiderfyOnMaxZoom: true,
      zoomToBoundsOnClick: true,
      iconCreateFunction: (c) => {
        const count = c.getChildCount()
        return L.divIcon({
          html: `<div class="ag-cluster-pin"><span>${count}</span></div>`,
          className: 'ag-cluster-icon',
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        })
      },
    })
    clusterGroupRef.current = cluster
    map.addLayer(cluster)

    return () => {
      map.removeLayer(cluster)
    }
  }, [map])

  useEffect(() => {
    const cluster = clusterGroupRef.current
    if (!cluster) return
    cluster.clearLayers()

    airstrips.forEach((f) => {
      const prop = f.properties
      const [lng, lat] = f.geometry.coordinates
      const score = prop.feasibility?.score ?? 0
      const isSelected = selectedAirstrip?.properties?.id === prop.id
      const icon = createAviationMarkerIcon(f, isSelected)

      const marker = L.marker([lat, lng], { icon })

      const popupContent = document.createElement('div')
      popupContent.innerHTML = `
        <div class="popup-name">${prop.name}</div>
        <div class="popup-row"><span>Jurisdiction</span><span>${prop.state || 'Unknown'}</span></div>
        <div class="popup-row"><span>Runway</span><span class="tabular-num">${prop.runway_length_m}m ${prop.surface}</span></div>
        <div class="popup-row"><span>Feasibility</span><strong class="tabular-num tier-text-${getTierKey(score)}">${score}/100 (${getTierLabel(score)})</strong></div>
        <div class="popup-click-hint">Open Flight-Data Readout in right bay</div>
      `
      marker.bindPopup(popupContent)
      marker.on('click', () => {
        onSelectAirstrip(f)
      })

      cluster.addLayer(marker)
    })
  }, [airstrips, selectedAirstrip, onSelectAirstrip])

  return null
}

export default function AirstripsMap() {
  const { currentUser, token } = useAuth()
  const { theme } = useTheme()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const searchInputRef = useRef(null)

  const [selectedAirstrip, setSelectedAirstrip] = useState(null)
  const [selectedAircraftId, setSelectedAircraftId] = useState('')
  const [manualBasemap, setManualBasemap] = useState(null)
  const basemap = manualBasemap || (theme === 'dark' ? 'dark' : 'light')
  const [showCapitals, setShowCapitals] = useState(false)

  const [filters, setFilters] = useState({
    query: '',
    surface: 'all',
    ownership: 'all',
    minRunway: 0,
    viability: 'all',
    political: 'all',
  })

  const [showAssetForm, setShowAssetForm] = useState(false)
  const [assetSubmitError, setAssetSubmitError] = useState('')
  const [assetSubmitting, setAssetSubmitting] = useState(false)
  const [assetForm, setAssetForm] = useState({
    name: '',
    asset_type: 'charging_station',
    status: 'operational',
    quantity: 1,
    capacity_spec: '',
  })

  const canModifyAssets = Boolean(token) && (currentUser?.role === 'admin' || currentUser?.role === 'analyst')

  const airstripsQuery = useApi((signal) => listAirstrips({}, { signal }), [])
  const aircraftQuery = useApi((signal) => listAircraft({ signal }), [token], { enabled: Boolean(token) })

  const airstrips = useMemo(() => {
    const features = airstripsQuery.data?.features
    return Array.isArray(features) ? features : []
  }, [airstripsQuery.data])

  const aircraftList = useMemo(() => aircraftQuery.data?.aircraft || [], [aircraftQuery.data])

  useEffect(() => {
    if (aircraftList.length > 0 && !selectedAircraftId) {
      setSelectedAircraftId(String(aircraftList[0].id))
    }
  }, [aircraftList, selectedAircraftId])

  const dataSource = airstripsQuery.isUnavailable
    ? 'unavailable'
    : airstripsQuery.data?.data_source || null

  const selectedStripId = selectedAirstrip?.properties?.id || null

  const assetsQuery = useApi(
    (signal) => listAirstripAssets(selectedStripId, { signal }),
    [selectedStripId, token],
    { enabled: Boolean(selectedStripId && token) }
  )

  const evaluationQuery = useApi(
    (signal) =>
      evaluateAirstrip(
        { aircraftId: Number(selectedAircraftId), airstripId: Number(selectedStripId) },
        { signal }
      ),
    [selectedStripId, selectedAircraftId, token],
    { enabled: Boolean(selectedStripId && selectedAircraftId && token) }
  )

  const assets = useMemo(() => assetsQuery.data?.assets || [], [assetsQuery.data])
  const caveatText =
    evaluationQuery.data?.caveat ||
    airstripsQuery.data?.caveat ||
    'Decision-support estimate. Verify with a site survey before committing.'

  // Pre-select airstrip from ?strip=<id> URL param
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
    setShowAssetForm(false)
    setAssetSubmitError('')
    setSearchParams({ strip: String(feature.properties.id) })
  }

  async function handleCreateAsset(e) {
    e.preventDefault()
    if (!assetForm.name.trim() || !selectedStripId) return
    setAssetSubmitting(true)
    setAssetSubmitError('')
    try {
      await createAirstripAsset(selectedStripId, {
        name: assetForm.name.trim(),
        asset_type: assetForm.asset_type,
        status: assetForm.status,
        condition_grade: 'good',
        quantity: Math.max(1, Number(assetForm.quantity) || 1),
        capacity_spec: assetForm.capacity_spec.trim() || undefined,
      })
      setAssetForm({ name: '', asset_type: 'charging_station', status: 'operational', quantity: 1, capacity_spec: '' })
      setShowAssetForm(false)
      assetsQuery.refetch()
    } catch (err) {
      setAssetSubmitError(err?.message || 'Failed to save asset.')
    } finally {
      setAssetSubmitting(false)
    }
  }

  const p = selectedAirstrip?.properties
  const coords = selectedAirstrip?.geometry?.coordinates
  const activeTile = TILE_LAYERS[basemap] || TILE_LAYERS.dark
  const selectedScore = p?.feasibility?.score ?? 0
  const selectedTier = getTierKey(selectedScore)
  const accessPoints = Array.isArray(p?.access_points) ? p.access_points : []
  const nearestHub = p?.nearest_airport?.code ? p.nearest_airport : null
  const clearances = useMemo(() => (p ? getAircraftClearance(p) : []), [p])
  const liveEval = evaluationQuery.data

  return (
    <div className={`map-page${basemap === 'light' ? ' light-mode-map' : ''}`}>
      {/* Docked Flight-Ops Filter Console */}
      <header className="map-header" aria-label="Sector Search and Filter Controls">
        <div className="map-top-row">
          <div className="map-title-cluster">
            <h1 className="map-console-title">Sector Feasibility Map</h1>
            <DataSourceBadge source={dataSource} loading={airstripsQuery.loading} />
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
                  onClick={() => setManualBasemap(key)}
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
          {airstripsQuery.loading && (
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

          {!airstripsQuery.loading && airstripsQuery.error && (
            <div className="map-state-overlay" role="alert">
              <div className="map-state-box">
                <div className="map-state-title">
                  {airstripsQuery.isUnavailable ? 'Database / Service Unavailable (503)' : 'Failed to Load Airstrips'}
                </div>
                <div className="map-state-desc">{airstripsQuery.error.message}</div>
                <button type="button" className="btn btn-primary" onClick={() => airstripsQuery.refetch()}>
                  Retry Connection
                </button>
              </div>
            </div>
          )}

          {!airstripsQuery.loading && !airstripsQuery.error && filtered.length === 0 && (
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

            <ClusteredAirstrips
              airstrips={filtered}
              selectedAirstrip={selectedAirstrip}
              onSelectAirstrip={handleSelectAirstrip}
            />

            {showCapitals &&
              ALL_CAPITALS.map((cap) => {
                const [lng, lat] = cap.coordinates
                return (
                  <CircleMarker
                    key={cap.state}
                    center={[lat, lng]}
                    radius={4.5}
                    pathOptions={{
                      color: 'var(--accent)',
                      fillColor: 'var(--accent)',
                      fillOpacity: 0.75,
                      weight: 1.5,
                    }}
                  >
                    <Popup>
                      <div className="popup-name">{cap.capital}</div>
                      <div className="popup-row"><span>Jurisdiction</span><span>{cap.state}</span></div>
                      <div className="popup-row"><span>Type</span><span>{cap.type} Capital</span></div>
                      <div className="popup-row"><span>WGS-84</span><span className="tabular-num">{lat.toFixed(3)}N, {lng.toFixed(3)}E</span></div>
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
              <div className="empty-detail-title">No Target Selected</div>
              <div className="empty-detail-desc">
                Select any paved runway strip or unpaved survey beacon on the map to inspect runway geometry, last-mile ground access, commercial hub distance, on-site assets, and aircraft evaluation.
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
                  ×
                </button>
              </div>

              {/* 2. Decision Engine Verdict & Score (single authoritative score) */}
              <section className="readout-section verdict-section">
                <div className="field-group" style={{ marginBottom: '10px' }}>
                  <label htmlFor="map-aircraft-select" className="field-label">
                    Aircraft Profile (Decision Engine)
                  </label>
                  {!token ? (
                    <div className="asset-empty-note">
                      Sign in to evaluate this airstrip with the decision engine.{' '}
                      <button type="button" className="inline-action-btn" onClick={() => navigate('/login')}>
                        Sign In
                      </button>
                    </div>
                  ) : (
                    <select
                      id="map-aircraft-select"
                      className="ops-input"
                      value={selectedAircraftId}
                      onChange={(e) => setSelectedAircraftId(e.target.value)}
                      disabled={aircraftQuery.loading || aircraftList.length === 0}
                    >
                      {aircraftList.map((ac) => (
                        <option key={ac.id} value={String(ac.id)}>
                          {ac.name} ({ac.category})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {token && evaluationQuery.loading && (
                  <div className="asset-empty-note">Running decision engine...</div>
                )}

                {token && evaluationQuery.error && (
                  <div className="login-error" role="alert">{evaluationQuery.error.message}</div>
                )}

                {token && liveEval && !evaluationQuery.loading && (() => {
                  const evalTier =
                    liveEval.verdict === 'viable'
                      ? 'high'
                      : liveEval.verdict === 'viable_with_conditions'
                      ? 'moderate'
                      : 'low'
                  const verdictLabel =
                    liveEval.verdict === 'viable'
                      ? 'VIABLE'
                      : liveEval.verdict === 'viable_with_conditions'
                      ? 'VIABLE WITH CONDITIONS'
                      : 'NOT VIABLE'
                  return (
                    <>
                      <div className="verdict-top-row">
                        <div className="verdict-score-cluster">
                          <span className={`verdict-score tabular-num tier-text-${evalTier}`}>
                            {liveEval.score}
                          </span>
                          <span className="verdict-denom tabular-num">/ 100</span>
                        </div>
                        <div className="verdict-status-stack">
                          <span className={`clearance-tag tag-${evalTier}`}>
                            {verdictLabel}
                          </span>
                          <div className="verdict-delta tabular-num">
                            {liveEval.aircraft?.name || 'Selected Aircraft'}
                          </div>
                        </div>
                      </div>

                      {liveEval.warnings?.length > 0 && (
                        <div style={{ marginTop: '8px' }}>
                          <div className="field-label" style={{ marginBottom: '4px' }}>
                            Warnings &amp; Missing-Data Conditions ({liveEval.warnings.length})
                          </div>
                          <ul className="reasons-list">
                            {liveEval.warnings.map((w, i) => (
                              <li key={i}>{w}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  )
                })()}

                <div className="clearance-matrix">
                  {clearances.map((c) => (
                    <div key={c.label} className={`clearance-cell ${c.cleared ? 'cell-cleared' : 'cell-restricted'}`}>
                      <span className="clearance-class">{c.label}</span>
                      <span className="clearance-req">{c.minReq}</span>
                      <span className="clearance-state">{c.cleared ? 'CLEARED' : 'RESTRICTED'}</span>
                    </div>
                  ))}
                </div>

                <div className="stitch-audit-caveat" style={{ marginTop: '8px' }}>
                  {caveatText}
                </div>
              </section>

              {/* 3. Runway Strip Schematic & Utilities */}
              <section className="readout-section">
                <h3 className="readout-section-title">Runway Geometry &amp; Ground Utilities</h3>
                <div className="spec-kv-grid">
                  <div className="spec-kv">
                    <span className="spec-k">Runway</span>
                    <span className="spec-v tabular-num">
                      {p.runway_length_m?.toLocaleString()}m × {p.runway_width_m || '--'}m
                    </span>
                  </div>
                  <div className="spec-kv">
                    <span className="spec-k">Surface</span>
                    <span className="spec-v capitalize">{p.surface}</span>
                  </div>
                  <div className="spec-kv">
                    <span className="spec-k">Elevation</span>
                    <span className="spec-v tabular-num">{p.elevation_m ?? '--'}m ASL</span>
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
                {accessPoints.length === 0 ? (
                  <div className="asset-empty-note">No verified last-mile access points recorded.</div>
                ) : (
                  <div className="readout-list">
                    {accessPoints.map((ap, i) => (
                      <div key={`${ap.name}-${i}`} className="readout-list-row">
                        <div className="readout-list-main">
                          <span className="access-type-tag">{String(ap.access_type || '').replace('_', ' ')}</span>
                          <span className="readout-list-name">{ap.name}</span>
                        </div>
                        <div className="readout-list-metrics tabular-num">
                          <span>{ap.distance_km} km</span>
                          {ap.drive_time_mins != null && <span className="metric-sub">{ap.drive_time_mins} min</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* 6. Nearest Commercial Hub Airport */}
              <section className="readout-section">
                <div className="readout-section-head">
                  <h3 className="readout-section-title">Nearest Hub Airport</h3>
                </div>
                {!nearestHub ? (
                  <div className="asset-empty-note">Nearest commercial hub distance not recorded.</div>
                ) : (
                  <div className="readout-list">
                    <div className="readout-list-row">
                      <div className="readout-list-main">
                        <span className="iata-badge iata-primary">{nearestHub.code}</span>
                        <span className="readout-list-name">{nearestHub.name}</span>
                      </div>
                      <div className="readout-list-metrics tabular-num">
                        <span>{nearestHub.distance_km} km</span>
                      </div>
                    </div>
                  </div>
                )}
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
                    <span className="readonly-note">{token ? 'Viewer Read-Only' : 'Sign In Required'}</span>
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
                    {assetSubmitError && <div className="login-error" role="alert">{assetSubmitError}</div>}
                    <button type="submit" className="btn btn-primary" disabled={assetSubmitting}>
                      {assetSubmitting ? 'Saving...' : 'Save Asset Record'}
                    </button>
                  </form>
                )}

                {!token ? (
                  <div className="asset-empty-note">Sign in to view on-site infrastructure assets.</div>
                ) : assetsQuery.loading ? (
                  <div className="asset-empty-note">Retrieving airstrip asset manifest...</div>
                ) : assetsQuery.error ? (
                  <div className="login-error" role="alert">{assetsQuery.error.message}</div>
                ) : assets.length === 0 ? (
                  <div className="asset-empty-note">No dedicated ground assets logged for this airstrip.</div>
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
          <span className="tabular-num">{filtered.length}/{airstrips.length} Airstrips</span>
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
          <span className="legend-item"><span className="legend-dot dot-high" /> High (70+)</span>
          <span className="legend-item"><span className="legend-dot dot-moderate" /> Moderate (40-69)</span>
          <span className="legend-item"><span className="legend-dot dot-low" /> Low (&lt;40)</span>
          <span className="legend-item"><span className="legend-sample-strip" /> Paved</span>
          <span className="legend-item"><span className="legend-sample-diamond" /> Unpaved</span>
        </div>
      </footer>
    </div>
  )
}
