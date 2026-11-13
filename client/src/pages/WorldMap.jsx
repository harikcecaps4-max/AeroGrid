import { useState, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { WORLD_AIRSTRIPS, WORLD_REGIONS } from '../data/worldAirstrips'

// Helper to construct custom HTML circular marker icon matching the reference design
function createPinpointIcon(score, isSelected, labelText) {
  let colorClass = 'pinpoint-moderate'
  if (score >= 70) colorClass = 'pinpoint-high'
  else if (score < 40) colorClass = 'pinpoint-low'

  const display = labelText || score
  const selectedStyle = isSelected ? 'transform: scale(1.2); box-shadow: 0 0 0 3px #2563eb, 0 4px 16px rgba(0,0,0,0.6);' : ''

  return L.divIcon({
    className: 'custom-pinpoint-marker',
    html: `<div class="pinpoint-node ${colorClass}" style="${selectedStyle}">${display}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  })
}

// Controller to smoothly fly or re-center the map when selecting a region or pinpoint
function MapController({ center, zoom }) {
  const map = useMap()
  useMemo(() => {
    if (center) {
      map.flyTo(center, zoom, { duration: 1.2 })
    }
  }, [center, zoom, map])
  return null
}

const REGION_COORDINATES = {
  'All Global': { center: [20.0, 10.0], zoom: 2 },
  'India': { center: [15.5, 77.5], zoom: 6 },
  'United States': { center: [37.0902, -95.7129], zoom: 4 },
  'Europe': { center: [48.8566, 9.3522], zoom: 5 },
  'Middle East': { center: [26.0, 48.0], zoom: 5 },
  'Asia-Pacific': { center: [10.0, 115.0], zoom: 4 },
  'Oceania': { center: [-28.0, 140.0], zoom: 4 },
  'Americas & Africa': { center: [-5.0, -10.0], zoom: 3 },
}

export default function WorldMap() {
  const [selectedRegion, setSelectedRegion] = useState('India')
  const [selectedStrip, setSelectedStrip] = useState(WORLD_AIRSTRIPS[0])
  const [mapTheme, setMapTheme] = useState('topo') // 'topo', 'dark', 'light'
  const [filterRating, setFilterRating] = useState('all')

  // Filter airstrips by region & score tier
  const filteredStrips = useMemo(() => {
    return WORLD_AIRSTRIPS.filter((s) => {
      if (selectedRegion !== 'All Global') {
        if (selectedRegion === 'India' && s.country !== 'India') return false
        if (selectedRegion === 'United States' && s.country !== 'United States') return false
        if (selectedRegion === 'Europe' && !['France', 'United Kingdom', 'Switzerland'].includes(s.country)) return false
        if (selectedRegion === 'Middle East' && !['United Arab Emirates', 'Saudi Arabia'].includes(s.country)) return false
        if (selectedRegion === 'Asia-Pacific' && !['Singapore', 'Malaysia', 'Japan'].includes(s.country)) return false
        if (selectedRegion === 'Oceania' && !['Australia', 'New Zealand'].includes(s.country)) return false
        if (selectedRegion === 'Americas & Africa' && !['Brazil', 'Kenya'].includes(s.country)) return false
      }

      if (filterRating === 'high' && s.score < 70) return false
      if (filterRating === 'moderate' && (s.score < 40 || s.score >= 70)) return false
      if (filterRating === 'low' && s.score >= 40) return false

      return true
    })
  }, [selectedRegion, filterRating])

  const currentView = REGION_COORDINATES[selectedRegion] || REGION_COORDINATES['All Global']

  // 100% Free, reliable global basemap tile services without API key requirements (Esri ArcGIS Global Basemaps)
  // maxNativeZoom tells Leaflet to fetch tiles up to zoom 16/17, and then automatically scale them seamlessly beyond that
  const tileConfigs = {
    // Topographic / Detailed relief and street map matching the reference image
    topo: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, MapmyIndia',
      maxNativeZoom: 17,
      maxZoom: 20,
    },
    // Dark matter tactical canvas mode
    dark: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
      maxNativeZoom: 16,
      maxZoom: 20,
    },
    // Crisp daylight light basemap
    light: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
      maxNativeZoom: 16,
      maxZoom: 20,
    },
  }

  return (
    <div className={`map-page ${mapTheme === 'light' ? 'light-mode-map' : ''}`}>
      {/* Top Controls Header */}
      <div className="map-header">
        <div>
          <h1 className="page-title" style={{ fontSize: 18 }}>Global Airstrips &amp; Regional Vertiports</h1>
          <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
            Worldwide Regional Aviation Grid | {filteredStrips.length} pinpoints shown
          </p>
        </div>

        <div className="map-filters">
          {/* Region Switcher */}
          <select
            className="filter-select"
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
          >
            {WORLD_REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          {/* Score / Viability Tier */}
          <select
            className="filter-select"
            value={filterRating}
            onChange={(e) => setFilterRating(e.target.value)}
          >
            <option value="all">All Viability Scores</option>
            <option value="high">High Viability (≥70)</option>
            <option value="moderate">Moderate (40–69)</option>
            <option value="low">Low Viability (&lt;40)</option>
          </select>

          {/* Map Basemap Style (Dark vs Realistic Light/Carto) */}
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              className={`btn ${mapTheme === 'topo' ? 'btn-primary' : 'btn-outlined'}`}
              style={{ padding: '5px 10px', fontSize: 12 }}
              onClick={() => setMapTheme('topo')}
              title="Reference Topo/Street Map"
            >
              Topo
            </button>
            <button
              className={`btn ${mapTheme === 'dark' ? 'btn-primary' : 'btn-outlined'}`}
              style={{ padding: '5px 10px', fontSize: 12 }}
              onClick={() => setMapTheme('dark')}
              title="Dark Radar Mode"
            >
              Dark
            </button>
            <button
              className={`btn ${mapTheme === 'light' ? 'btn-primary' : 'btn-outlined'}`}
              style={{ padding: '5px 10px', fontSize: 12 }}
              onClick={() => setMapTheme('light')}
              title="Clean Light Basemap"
            >
              Light
            </button>
          </div>
        </div>
      </div>

      {/* Map Body */}
      <div className="map-body" style={{ position: 'relative' }}>
        {/* Floating Region Breadcrumb Pill (as seen in user reference) */}
        <div className={`map-floating-pill ${mapTheme === 'light' ? 'map-floating-pill-light' : ''}`}>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
            <polygon points="1,3 6,1 10,3 15,1 15,13 10,15 6,13 1,15" />
            <line x1="6" y1="1" x2="6" y2="13" />
            <line x1="10" y1="3" x2="10" y2="15" />
          </svg>
          <span>
            {selectedRegion === 'All Global'
              ? 'World Grid | All Continents'
              : `${selectedRegion} | Regional Sector`}
          </span>
          <span style={{ opacity: 0.6, fontSize: 11, marginLeft: 4 }}>
            ({filteredStrips.length} pinpoints)
          </span>
        </div>

        {/* Map Canvas */}
        <div className="map-container">
          <MapContainer
            center={currentView.center}
            zoom={currentView.zoom}
            style={{ height: '100%', width: '100%' }}
            zoomControl={true}
          >
            <MapController center={currentView.center} zoom={currentView.zoom} />

            <TileLayer
              key={mapTheme}
              url={tileConfigs[mapTheme]?.url || tileConfigs.topo.url}
              attribution={tileConfigs[mapTheme]?.attribution || tileConfigs.topo.attribution}
              maxNativeZoom={tileConfigs[mapTheme]?.maxNativeZoom || 16}
              maxZoom={tileConfigs[mapTheme]?.maxZoom || 20}
            />

            {filteredStrips.map((strip) => {
              const [lng, lat] = strip.location
              const isSelected = selectedStrip?.id === strip.id
              const icon = createPinpointIcon(strip.score, isSelected)

              return (
                <Marker
                  key={strip.id}
                  position={[lat, lng]}
                  icon={icon}
                  eventHandlers={{
                    click: () => setSelectedStrip(strip),
                  }}
                >
                  <Popup>
                    <div className="popup-name">{strip.name}</div>
                    <div className="popup-row">
                      <span>Jurisdiction</span>
                      <span style={{ color: 'var(--subheading)' }}>
                        {strip.region}, {strip.country}
                      </span>
                    </div>
                    <div className="popup-row">
                      <span>Classification</span>
                      <span style={{ color: 'var(--subheading)' }}>{strip.type}</span>
                    </div>
                    <div className="popup-row">
                      <span>Runway &amp; Pavement</span>
                      <span style={{ color: 'var(--subheading)' }}>
                        {strip.runway_m}m {strip.surface}
                      </span>
                    </div>
                    <div className="popup-row">
                      <span>Viability Score</span>
                      <strong
                        style={{
                          fontFamily: 'var(--mono)',
                          color: strip.score >= 70 ? '#0f766e' : strip.score >= 40 ? '#92400e' : '#991b1b',
                        }}
                      >
                        {strip.score}/100 ({strip.rating})
                      </strong>
                    </div>
                  </Popup>
                </Marker>
              )
            })}
          </MapContainer>
        </div>

        {/* Detail Inspector Sidebar */}
        <div className="map-detail-panel">
          {selectedStrip ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <h3 style={{ fontSize: 16, color: 'var(--heading)', margin: 0, fontWeight: 600 }}>
                    {selectedStrip.name}
                  </h3>
                  <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>
                    {selectedStrip.region}, {selectedStrip.country}
                  </div>
                </div>
                <div
                  className="pinpoint-node"
                  style={{
                    backgroundColor:
                      selectedStrip.score >= 70
                        ? '#0f766e'
                        : selectedStrip.score >= 40
                        ? '#92400e'
                        : '#991b1b',
                    width: 38,
                    height: 38,
                    fontSize: 13,
                    flexShrink: 0,
                  }}
                >
                  {selectedStrip.score}
                </div>
              </div>

              {/* Status Badge */}
              <div style={{ marginBottom: 16 }}>
                <span
                  style={{
                    padding: '3px 8px',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 600,
                    backgroundColor:
                      selectedStrip.score >= 70
                        ? 'rgba(15, 118, 110, 0.2)'
                        : selectedStrip.score >= 40
                        ? 'rgba(146, 64, 14, 0.2)'
                        : 'rgba(153, 27, 27, 0.2)',
                    color:
                      selectedStrip.score >= 70
                        ? '#2dd4bf'
                        : selectedStrip.score >= 40
                        ? '#fbbf24'
                        : '#f87171',
                    border: '1px solid currentColor',
                  }}
                >
                  {selectedStrip.rating}
                </span>
              </div>

              {/* Specs Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                <div className="card" style={{ padding: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-2)' }}>FACILITY TYPE</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--heading)', marginTop: 2 }}>
                    {selectedStrip.type}
                  </div>
                </div>
                <div className="card" style={{ padding: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-2)' }}>SURFACE</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--heading)', marginTop: 2 }}>
                    {selectedStrip.surface}
                  </div>
                </div>
                <div className="card" style={{ padding: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-2)' }}>RUNWAY LENGTH</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--heading)', marginTop: 2, fontFamily: 'var(--mono)' }}>
                    {selectedStrip.runway_m} meters
                  </div>
                </div>
                <div className="card" style={{ padding: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-2)' }}>COORDINATES</div>
                  <div style={{ fontSize: 11, color: 'var(--heading)', marginTop: 4, fontFamily: 'var(--mono)' }}>
                    {selectedStrip.location[1].toFixed(2)}°N, {selectedStrip.location[0].toFixed(2)}°E
                  </div>
                </div>
              </div>

              {/* Score Visual Bar */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                  <span style={{ color: 'var(--text-2)' }}>Feasibility Index</span>
                  <span style={{ fontFamily: 'var(--mono)', color: 'var(--heading)' }}>
                    {selectedStrip.score}/100
                  </span>
                </div>
                <div className="horiz-bar-track">
                  <div
                    className="horiz-bar-fill"
                    style={{
                      width: `${selectedStrip.score}%`,
                      backgroundColor:
                        selectedStrip.score >= 70
                          ? '#0f766e'
                          : selectedStrip.score >= 40
                          ? '#92400e'
                          : '#991b1b',
                    }}
                  />
                </div>
              </div>

              {/* Pinpoint Legend Guide */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                <div style={{ fontSize: 11, color: 'var(--text-2)', textTransform: 'uppercase', marginBottom: 10, letterSpacing: 0.5 }}>
                  Marker Pinpoint Color Coding
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="pinpoint-node pinpoint-high" style={{ width: 22, height: 22, fontSize: 10 }}>
                      85
                    </div>
                    <span style={{ color: 'var(--subheading)' }}>Score ≥ 70: High Viability (Deep Teal)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="pinpoint-node pinpoint-moderate" style={{ width: 22, height: 22, fontSize: 10 }}>
                      57
                    </div>
                    <span style={{ color: 'var(--subheading)' }}>Score 40–69: Moderate (Warm Ochre)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="pinpoint-node pinpoint-low" style={{ width: 22, height: 22, fontSize: 10 }}>
                      28
                    </div>
                    <span style={{ color: 'var(--subheading)' }}>Score &lt; 40: Low Viability (Crimson Red)</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-detail">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" style={{ opacity: 0.25 }}>
                <circle cx="12" cy="10" r="3" />
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
              </svg>
              <div style={{ color: 'var(--text-2)', fontSize: 13 }}>Select a pinpoint</div>
              <div style={{ color: 'var(--text-2)', fontSize: 12, opacity: 0.7 }}>
                Click any numbered pin to inspect full specs
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

