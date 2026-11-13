import { useState } from 'react'
import { MOCK_AIRSTRIPS } from '../data/mockData'

export default function Reports() {
  const [downloading, setDownloading] = useState(false)

  const airstrips = MOCK_AIRSTRIPS
  const total = airstrips.length
  const highViability = airstrips.filter((a) => a.properties.feasibility.score >= 70).length
  const moderateViability = airstrips.filter(
    (a) => a.properties.feasibility.score >= 40 && a.properties.feasibility.score < 70
  ).length
  const lowViability = airstrips.filter((a) => a.properties.feasibility.score < 40).length

  function exportCSV() {
    setDownloading(true)
    const headers = [
      'ID',
      'Name',
      'State',
      'Ownership',
      'Surface',
      'Runway Length (m)',
      'Runway Width (m)',
      'Elevation (m)',
      'Night Landing',
      'Fuel Available',
      'Charging Available',
      'Feasibility Score',
      'Rating Tier',
      'Nearest Commercial Hub',
      'Distance to Hub (km)',
    ]

    const rows = airstrips.map((item) => {
      const p = item.properties
      return [
        p.id,
        `"${p.name}"`,
        `"${p.state}"`,
        `"${p.ownership}"`,
        `"${p.surface}"`,
        p.runway_length_m,
        p.runway_width_m,
        p.elevation_m,
        p.night_landing ? 'YES' : 'NO',
        p.fuel_available ? 'YES' : 'NO',
        p.charging_available ? 'YES' : 'NO',
        p.feasibility.score,
        `"${p.feasibility.rating}"`,
        `"${p.nearest_airport.name}"`,
        p.nearest_airport.distance_km,
      ].join(',')
    })

    const csvContent = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `AeroGrid_Airstrips_Registry_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    setTimeout(() => setDownloading(false), 600)
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Executive Reports &amp; Exports</h1>
          <p className="page-subtitle">
            Audit-grade regional aviation feasibility manifests, GIS layers, and compliance summaries
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={exportCSV}
          disabled={downloading}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M8 2v9M5 8l3 3 3-3" />
            <path d="M2 13h12" />
          </svg>
          {downloading ? 'Generating CSV…' : 'Export Full CSV Manifest'}
        </button>
      </div>

      {/* Summary Metrics */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Total Audited Airstrips</span>
            <div className="stat-icon-wrap">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="2" width="12" height="12" rx="2" />
                <path d="M2 6h12" />
              </svg>
            </div>
          </div>
          <div className="stat-value">{total}</div>
          <div className="stat-meta">Active evaluated airstrips</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Tier-1 High Viability</span>
            <div className="stat-icon-wrap" style={{ color: '#34d399' }}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="8" cy="8" r="6" />
                <path d="M5 8l2 2 4-4" />
              </svg>
            </div>
          </div>
          <div className="stat-value" style={{ color: '#34d399' }}>{highViability}</div>
          <div className="stat-meta">Ready for immediate operation</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Moderate Viability</span>
            <div className="stat-icon-wrap" style={{ color: '#fbbf24' }}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="8" cy="8" r="6" />
                <line x1="8" y1="5" x2="8" y2="9" />
                <circle cx="8" cy="11.5" r="0.5" fill="currentColor" />
              </svg>
            </div>
          </div>
          <div className="stat-value" style={{ color: '#fbbf24' }}>{moderateViability}</div>
          <div className="stat-meta">Minor upgrades needed</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Infrastructure Gaps</span>
            <div className="stat-icon-wrap" style={{ color: '#f87171' }}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="8" cy="8" r="6" />
                <line x1="5" y1="5" x2="11" y2="11" />
              </svg>
            </div>
          </div>
          <div className="stat-value" style={{ color: '#f87171' }}>{lowViability}</div>
          <div className="stat-meta">Runway/utility remediation required</div>
        </div>
      </div>

      {/* Report Tables & Actions */}
      <div className="dashboard-grid" style={{ gridTemplateColumns: '2fr 1.2fr' }}>
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">Available Export Packages</div>
            <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>STANDARD FORMATS</span>
          </div>
          <div className="panel-body" style={{ padding: '8px 0' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 20px',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <div>
                <div style={{ fontWeight: 600, color: 'var(--heading)', fontSize: 13.5 }}>
                  National Regional Airstrip Audit Report (CSV)
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
                  Full tabular dump containing dimensional metrics, feasibility scores, and hub distances.
                </div>
              </div>
              <button className="btn btn-outlined" style={{ fontSize: 12 }} onClick={exportCSV}>
                Download .CSV
              </button>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 20px',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <div>
                <div style={{ fontWeight: 600, color: 'var(--heading)', fontSize: 13.5 }}>
                  GeoJSON Spatial Layer (All Features)
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
                  RFC 7946 compliant GeoJSON point dataset compatible with QGIS, ArcGIS, and Leaflet.
                </div>
              </div>
              <button
                className="btn btn-outlined"
                style={{ fontSize: 12 }}
                onClick={() => {
                  const geojson = { type: 'FeatureCollection', count: airstrips.length, features: airstrips }
                  const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json' })
                  const url = URL.createObjectURL(blob)
                  const link = document.createElement('a')
                  link.href = url
                  link.download = `AeroGrid_Spatial_Layer_${new Date().toISOString().slice(0, 10)}.geojson`
                  link.click()
                }}
              >
                Export .GeoJSON
              </button>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 20px',
              }}
            >
              <div>
                <div style={{ fontWeight: 600, color: 'var(--heading)', fontSize: 13.5 }}>
                  PostgreSQL Seed Migration (.SQL)
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
                  Database script with PostGIS geometries for self-hosted Neon/RDS instances.
                </div>
              </div>
              <span className="badge badge-high" style={{ fontSize: 10.5 }}>Available in repo</span>
            </div>
          </div>
        </div>

        {/* Methodology Card */}
        <div className="panel" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--heading)', marginBottom: 12 }}>
            Evaluation Methodology
          </h3>
          <p style={{ fontSize: 12.5, color: 'var(--text)', lineHeight: 1.6, marginBottom: 16 }}>
            The AeroGrid Feasibility Index uses an explainable multi-variable matrix:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--text-2)' }}>Runway Length (&ge;1000m)</span>
              <span style={{ fontFamily: 'var(--mono)', color: 'var(--heading)' }}>25 pts</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--text-2)' }}>Pavement (Asphalt/Concrete)</span>
              <span style={{ fontFamily: 'var(--mono)', color: 'var(--heading)' }}>20 pts</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--text-2)' }}>Utilities (Lighting, Fuel, Charging)</span>
              <span style={{ fontFamily: 'var(--mono)', color: 'var(--heading)' }}>30 pts</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--text-2)' }}>Commercial Hub Proximity</span>
              <span style={{ fontFamily: 'var(--mono)', color: 'var(--heading)' }}>25 pts</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
