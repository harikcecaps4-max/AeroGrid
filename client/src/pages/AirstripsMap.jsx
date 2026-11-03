import { useState, useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, CircleMarker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { MOCK_AIRSTRIPS } from '../data/mockData'
import { ALL_CAPITALS } from '../data/indiaGeo'

// Helper to construct custom numbered circular pinpoint icon matching the reference style
function createPinpointIcon(score, isSelected) {
  let colorClass = 'pinpoint-moderate'
  if (score >= 70) colorClass = 'pinpoint-high'
  else if (score < 40) colorClass = 'pinpoint-low'

  const selectedStyle = isSelected
    ? 'transform: scale(1.2); box-shadow: 0 0 0 3px #2563eb, 0 4px 16px rgba(0,0,0,0.6);'
    : ''

  return L.divIcon({
    className: 'custom-pinpoint-marker',
    html: `<div class="pinpoint-node ${colorClass}" style="${selectedStyle}">${score}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  })
}

function getMarkerColor(score) {
  if (score >= 70) return '#22c55e'
  if (score >= 40) return '#eab308'
  return '#ef4444'
}

function getRatingBadge(rating) {
  if (!rating) return null
  const r = rating.toLowerCase()
  if (r.includes('high')) return <span className="badge badge-high">High Viability</span>
  if (r.includes('moderate')) return <span className="badge badge-moderate">Moderate</span>
  return <span className="badge badge-low">Low Viability</span>
}

function MapController({ center }) {
  const map = useMap()
  useEffect(() => {
    if (center) map.setView(center, map.getZoom())
  }, [center, map])
  return null
}

export default function AirstripsMap() {
  const [airstrips, setAirstrips] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedAirstrip, setSelectedAirstrip] = useState(null)
  const [filters, setFilters] = useState({ state: 'all', surface: 'all', viability: 'all' })
  const [showCapitals, setShowCapitals] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    async function fetchData() {
      try {
        const res = await fetch('/api/airstrips', { signal: controller.signal })
        if (!res.ok) throw new Error()
        const json = await res.json()
        const features = json.features ?? json
        setAirstrips(Array.isArray(features) ? features : MOCK_AIRSTRIPS)
      } catch {
        setAirstrips(MOCK_AIRSTRIPS)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
    return () => controller.abort()
  }, [])

  const states = useMemo(() => {
    const s = new Set(airstrips.map((f) => f.properties.state))
    return Array.from(s).sort()
  }, [airstrips])

  const surfaces = useMemo(() => {
    const s = new Set(airstrips.map((f) => f.properties.surface))
    return Array.from(s).sort()
  }, [airstrips])

  const filtered = useMemo(() => {
    return airstrips.filter((f) => {
      const p = f.properties
      const score = p.feasibility?.score ?? 0
      if (filters.state !== 'all' && p.state !== filters.state) return false
      if (filters.surface !== 'all' && p.surface !== filters.surface) return false
      if (filters.viability === 'high' && score < 70) return false
      if (filters.viability === 'moderate' && (score < 40 || score >= 70)) return false
      if (filters.viability === 'low' && score >= 40) return false
      return true
    })
  }, [airstrips, filters])

  const p = selectedAirstrip?.properties

  return (
    <div className="map-page">
      {/* Header */}
      <div className="map-header">
        <div>
          <h1 className="page-title" style={{ fontSize: 18 }}>Airstrips Map</h1>
          <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
            {loading ? 'Loading…' : `${filtered.length} of ${airstrips.length} airstrips shown`}
          </p>
        </div>
        <div className="map-filters">
          <select
            className="filter-select"
            value={filters.state}
            onChange={(e) => setFilters((f) => ({ ...f, state: e.target.value }))}
          >
            <option value="all">All States</option>
            {states.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>

          <select
            className="filter-select"
            value={filters.surface}
            onChange={(e) => setFilters((f) => ({ ...f, surface: e.target.value }))}
          >
            <option value="all">All Surfaces</option>
            {surfaces.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>

          <select
            className="filter-select"
            value={filters.viability}
            onChange={(e) => setFilters((f) => ({ ...f, viability: e.target.value }))}
          >
            <option value="all">All Viability</option>
            <option value="high">High (≥70)</option>
            <option value="moderate">Moderate (40–69)</option>
            <option value="low">Low (&lt;40)</option>
          </select>

          <button
            className={`btn ${showCapitals ? 'btn-primary' : 'btn-outlined'}`}
            style={{ fontSize: 12, padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 5 }}
            onClick={() => setShowCapitals(!showCapitals)}
            title="Toggle state and UT administrative capital markers"
          >
            <span style={{ fontSize: 11 }}>★</span>
            Capitals ({ALL_CAPITALS.length})
          </button>

          {(filters.state !== 'all' || filters.surface !== 'all' || filters.viability !== 'all') && (
            <button
              className="btn btn-outlined"
              style={{ fontSize: 12, padding: '5px 10px' }}
              onClick={() => setFilters({ state: 'all', surface: 'all', viability: 'all' })}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Map + detail panel */}
      <div className="map-body">
        <div className="map-container">
          <MapContainer
            center={[20.5937, 78.9629]}
            zoom={5}
            style={{ height: '100%', width: '100%' }}
            zoomControl={true}
          >
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
              attribution="Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ"
              maxNativeZoom={16}
              maxZoom={20}
            />
            {filtered.map((f) => {
              const prop = f.properties
              const [lng, lat] = f.geometry.coordinates
              const score = prop.feasibility?.score ?? 0
              const isSelected = selectedAirstrip?.properties?.id === prop.id
              const icon = createPinpointIcon(score, isSelected)

              return (
                <Marker
                  key={prop.id}
                  position={[lat, lng]}
                  icon={icon}
                  eventHandlers={{
                    click: () => setSelectedAirstrip(f),
                  }}
                >
                  <Popup>
                    <div className="popup-name">{prop.name}</div>
                    <div className="popup-row">
                      <span>State</span>
                      <span style={{ color: 'var(--subheading)' }}>{prop.state}</span>
                    </div>
                    <div className="popup-row">
                      <span>Surface</span>
                      <span style={{ color: 'var(--subheading)' }}>{prop.surface}</span>
                    </div>
                    <div className="popup-row">
                      <span>Runway</span>
                      <span style={{ color: 'var(--subheading)' }}>{prop.runway_length_m}m</span>
                    </div>
                    <div className="popup-row">
                      <span>Viability Score</span>
                      <strong
                        style={{
                          fontFamily: 'var(--mono)',
                          color: score >= 70 ? '#0f766e' : score >= 40 ? '#92400e' : '#991b1b',
                        }}
                      >
                        {score}/100 ({prop.feasibility?.rating || 'Assessed'})
                      </strong>
                    </div>
                    <div className="popup-click-hint">Click pin for detailed viability report →</div>
                  </Popup>
                </Marker>
              )
            })}

            {/* State & UT Capital Markers Overlay */}
            {showCapitals &&
              ALL_CAPITALS.map((cap) => {
                const [lng, lat] = cap.coordinates
                return (
                  <CircleMarker
                    key={cap.state}
                    center={[lat, lng]}
                    radius={5}
                    pathOptions={{
                      color: '#60a5fa',
                      fillColor: '#3b82f6',
                      fillOpacity: 0.9,
                      weight: 1.5,
                    }}
                  >
                    <Popup>
                      <div className="popup-name" style={{ color: '#60a5fa' }}>
                        ★ {cap.capital}
                      </div>
                      <div className="popup-row">
                        <span>Jurisdiction</span>
                        <span style={{ color: 'var(--subheading)' }}>{cap.state}</span>
                      </div>
                      <div className="popup-row">
                        <span>Classification</span>
                        <span style={{ color: 'var(--subheading)' }}>{cap.type} Capital</span>
                      </div>
                      <div className="popup-row">
                        <span>Coordinates</span>
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>
                          {lat.toFixed(3)}°N, {lng.toFixed(3)}°E
                        </span>
                      </div>
                    </Popup>
                  </CircleMarker>
                )
              })}
          </MapContainer>
        </div>

        {/* Detail panel */}
        <div className="map-detail-panel">
          {!selectedAirstrip ? (
            <div className="empty-detail">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" style={{ opacity: 0.25 }}>
                <circle cx="12" cy="10" r="3" />
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
              </svg>
              <div style={{ color: 'var(--text-2)', fontSize: 13 }}>Select a marker</div>
              <div style={{ color: 'var(--text-2)', fontSize: 12, opacity: 0.7 }}>Click any airstrip on the map to view its details</div>
            </div>
          ) : (
            <>
              {/* Detail header */}
              <div className="detail-panel-header">
                <div>
                  <div className="detail-panel-title">{p.name}</div>
                  <div className="detail-panel-state">{p.state} · {p.ownership}</div>
                </div>
                <button className="close-btn" onClick={() => setSelectedAirstrip(null)}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <line x1="4" y1="4" x2="12" y2="12" />
                    <line x1="12" y1="4" x2="4" y2="12" />
                  </svg>
                </button>
              </div>

              {/* Feasibility score */}
              <div className="detail-section">
                <div className="detail-section-label">Feasibility Score</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 32, fontWeight: 500, color: 'var(--heading)', letterSpacing: '-0.03em', lineHeight: 1 }}>
                    {p.feasibility?.score ?? '—'}
                  </span>
                  <div>
                    {getRatingBadge(p.feasibility?.rating)}
                    <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 4 }}>out of 100</div>
                  </div>
                </div>
              </div>

              {/* Properties */}
              <div className="detail-section">
                <div className="detail-section-label">Properties</div>
                {[
                  ['Surface', p.surface],
                  ['Runway Length', `${p.runway_length_m}m`],
                  ['Runway Width', `${p.runway_width_m}m`],
                  ['Elevation', `${p.elevation_m}m ASL`],
                  ['Night Landing', p.night_landing ? 'Available' : 'Not available'],
                  ['Fuel', p.fuel_available ? 'Available' : 'Not available'],
                  ['EV Charging', p.charging_available ? 'Available' : 'Not available'],
                ].map(([k, v]) => (
                  <div key={k} className="detail-prop-row">
                    <span className="detail-prop-key">{k}</span>
                    <span className="detail-prop-val">{v}</span>
                  </div>
                ))}
              </div>

              {/* Nearest airport */}
              {p.nearest_airport && (
                <div className="detail-section">
                  <div className="detail-section-label">Nearest Airport</div>
                  <div className="detail-prop-row">
                    <span className="detail-prop-key">Code</span>
                    <span className="detail-prop-val">{p.nearest_airport.code}</span>
                  </div>
                  <div className="detail-prop-row">
                    <span className="detail-prop-key">Name</span>
                    <span style={{ fontSize: 12, color: 'var(--text)', textAlign: 'right', maxWidth: 170 }}>{p.nearest_airport.name}</span>
                  </div>
                  <div className="detail-prop-row">
                    <span className="detail-prop-key">Distance</span>
                    <span className="detail-prop-val">{p.nearest_airport.distance_km} km</span>
                  </div>
                </div>
              )}

              {/* Breakdown */}
              {p.feasibility?.breakdown && (
                <div className="detail-section">
                  <div className="detail-section-label">Score Breakdown</div>
                  {Object.entries(p.feasibility.breakdown).map(([key, val]) => (
                    <div key={key} className="breakdown-bar-wrap">
                      <div className="breakdown-bar-label">
                        <span style={{ textTransform: 'capitalize' }}>{key}</span>
                        <span className="breakdown-bar-num">{val}/25</span>
                      </div>
                      <div className="breakdown-track">
                        <div className="breakdown-fill" style={{ width: `${(val / 25) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Reasons */}
              {p.feasibility?.reasons?.length > 0 && (
                <div className="detail-section">
                  <div className="detail-section-label">Assessment Notes</div>
                  <ul className="reasons-list">
                    {p.feasibility.reasons.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
