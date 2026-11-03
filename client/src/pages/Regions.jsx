import { useState, useMemo } from 'react'
import {
  INDIA_GEO_DATA,
  ALL_STATES,
  ALL_UNION_TERRITORIES,
  ALL_CAPITALS,
  ALL_CITIES,
} from '../data/indiaGeo'

export default function Regions() {
  const [activeTab, setActiveTab] = useState('all') // 'all', 'states', 'uts'
  const [search, setSearch] = useState('')
  const [selectedRegion, setSelectedRegion] = useState(INDIA_GEO_DATA[0])
  const [citySearch, setCitySearch] = useState('')

  // Filter regions
  const filteredRegions = useMemo(() => {
    let list = INDIA_GEO_DATA
    if (activeTab === 'states') {
      list = ALL_STATES
    } else if (activeTab === 'uts') {
      list = ALL_UNION_TERRITORIES
    }

    if (!search.trim()) return list
    const q = search.toLowerCase()
    return list.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.capital.toLowerCase().includes(q) ||
        r.cities.some((c) => c.name.toLowerCase().includes(q))
    )
  }, [activeTab, search])

  // Filter cities inside selected region
  const filteredCities = useMemo(() => {
    if (!selectedRegion) return []
    if (!citySearch.trim()) return selectedRegion.cities
    const q = citySearch.toLowerCase()
    return selectedRegion.cities.filter((c) => c.name.toLowerCase().includes(q))
  }, [selectedRegion, citySearch])

  return (
    <div className="page-content">
      {/* Top Header */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title">States &amp; Territories Explorer</h1>
          <p className="page-subtitle">
            Comprehensive National Geospatial Registry — 28 States, 8 Union Territories, State Capitals &amp; Major Cities
          </p>
        </div>
      </div>

      {/* Top Key Metrics Row */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">States</span>
            <div className="stat-icon-wrap">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="2" width="12" height="12" rx="2" />
                <path d="M2 6h12M6 2v12" />
              </svg>
            </div>
          </div>
          <div className="stat-value">{ALL_STATES.length}</div>
          <div className="stat-meta">Federated States of India</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Union Territories</span>
            <div className="stat-icon-wrap">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="8" cy="8" r="6" />
                <path d="M8 2v12M2 8h12" />
              </svg>
            </div>
          </div>
          <div className="stat-value">{ALL_UNION_TERRITORIES.length}</div>
          <div className="stat-meta">Centrally Administered</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Capitals Tracked</span>
            <div className="stat-icon-wrap">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <polygon points="8,1 10,6 15,6 11,9 13,14 8,11 3,14 5,9 1,6 6,6" />
              </svg>
            </div>
          </div>
          <div className="stat-value">{ALL_CAPITALS.length}</div>
          <div className="stat-meta">100% Administrative Capitals</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Cities Mapped</span>
            <div className="stat-icon-wrap">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 14V6l5-4 5 4v8H3z" />
                <rect x="6" y="9" width="4" height="5" />
              </svg>
            </div>
          </div>
          <div className="stat-value">{ALL_CITIES.length}</div>
          <div className="stat-meta">Major Urban &amp; Regional Nodes</div>
        </div>
      </div>

      {/* Main Two-Column Explorer Layout */}
      <div className="dashboard-grid" style={{ gridTemplateColumns: '1.2fr 1.8fr', alignItems: 'start' }}>
        {/* Left Column: List of States & UTs with Filter/Search */}
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h2 className="card-title" style={{ margin: 0 }}>Regions ({filteredRegions.length})</h2>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className={`btn ${activeTab === 'all' ? 'btn-primary' : 'btn-outlined'}`}
                style={{ padding: '4px 10px', fontSize: 12 }}
                onClick={() => setActiveTab('all')}
              >
                All (36)
              </button>
              <button
                className={`btn ${activeTab === 'states' ? 'btn-primary' : 'btn-outlined'}`}
                style={{ padding: '4px 10px', fontSize: 12 }}
                onClick={() => setActiveTab('states')}
              >
                States (28)
              </button>
              <button
                className={`btn ${activeTab === 'uts' ? 'btn-primary' : 'btn-outlined'}`}
                style={{ padding: '4px 10px', fontSize: 12 }}
                onClick={() => setActiveTab('uts')}
              >
                UTs (8)
              </button>
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <input
              type="text"
              placeholder="Search state, UT, capital, or city..."
              className="filter-select"
              style={{ width: '100%', boxSizing: 'border-box', height: 36, paddingLeft: 12 }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Scrollable list */}
          <div style={{ maxHeight: '600px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, paddingRight: 4 }}>
            {filteredRegions.map((region) => {
              const isSelected = selectedRegion?.name === region.name
              return (
                <div
                  key={region.name}
                  onClick={() => {
                    setSelectedRegion(region)
                    setCitySearch('')
                  }}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 4,
                    background: isSelected ? 'var(--surface-2)' : 'transparent',
                    border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600, color: 'var(--heading)', fontSize: 13 }}>
                        {region.name}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          padding: '1px 6px',
                          borderRadius: 3,
                          background: region.type === 'State' ? 'rgba(37, 99, 235, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                          color: region.type === 'State' ? '#60a5fa' : '#94a3b8',
                          fontWeight: 500,
                        }}
                      >
                        {region.type === 'State' ? 'STATE' : 'UT'}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
                      Capital: <span style={{ color: 'var(--subheading)' }}>{region.capital}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--text)' }}>
                      {region.cities.length} cities
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right Column: Selected Region Details & Cities Table */}
        {selectedRegion && (
          <div className="card" style={{ padding: 20 }}>
            {/* Header info */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border)', paddingBottom: 16, marginBottom: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <h2 style={{ fontSize: 20, margin: 0, color: 'var(--heading)' }}>
                    {selectedRegion.name}
                  </h2>
                  <span
                    style={{
                      fontSize: 11,
                      padding: '2px 8px',
                      borderRadius: 4,
                      background: 'rgba(37, 99, 235, 0.2)',
                      color: '#93c5fd',
                      border: '1px solid rgba(37, 99, 235, 0.4)',
                      fontWeight: 600,
                    }}
                  >
                    {selectedRegion.type.toUpperCase()}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text)', marginTop: 6 }}>
                  Capital City:{' '}
                  <strong style={{ color: 'var(--heading)' }}>{selectedRegion.capital}</strong>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-2)', marginLeft: 8 }}>
                    [{selectedRegion.capital_coords[1].toFixed(4)}°N, {selectedRegion.capital_coords[0].toFixed(4)}°E]
                  </span>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Total Key Cities
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--heading)' }}>
                  {selectedRegion.cities.length}
                </div>
              </div>
            </div>

            {/* Cities Filter & Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: 14, margin: 0, color: 'var(--heading)', fontWeight: 600 }}>
                Cities &amp; Regional Hubs
              </h3>
              <input
                type="text"
                placeholder="Filter cities..."
                className="filter-select"
                style={{ width: 180, height: 32, fontSize: 12, paddingLeft: 8 }}
                value={citySearch}
                onChange={(e) => setCitySearch(e.target.value)}
              />
            </div>

            {/* Cities Table */}
            <div className="table-wrap" style={{ maxHeight: '490px', overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>City Name</th>
                    <th>Role</th>
                    <th>Coordinates (Lat, Lon)</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCities.map((city, idx) => (
                    <tr key={city.name}>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-2)', width: 40 }}>
                        {idx + 1}
                      </td>
                      <td style={{ fontWeight: city.is_capital ? 600 : 400, color: city.is_capital ? 'var(--heading)' : 'var(--text)' }}>
                        {city.name}
                      </td>
                      <td>
                        {city.is_capital ? (
                          <span
                            style={{
                              fontSize: 10,
                              padding: '2px 6px',
                              borderRadius: 3,
                              background: 'rgba(34, 197, 94, 0.15)',
                              color: '#4ade80',
                              border: '1px solid rgba(34, 197, 94, 0.3)',
                              fontWeight: 600,
                            }}
                          >
                            CAPITAL
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--text-2)' }}>Major City</span>
                        )}
                      </td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-2)' }}>
                        {city.coords[1].toFixed(4)}°N, {city.coords[0].toFixed(4)}°E
                      </td>
                    </tr>
                  ))}
                  {filteredCities.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-2)' }}>
                        No cities found matching &quot;{citySearch}&quot;
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

