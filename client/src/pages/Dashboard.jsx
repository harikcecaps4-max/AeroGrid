import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import StatCard from '../components/StatCard'
import { MOCK_AIRSTRIPS } from '../data/mockData'

function getRatingBadge(rating) {
  if (!rating) return null
  const r = rating.toLowerCase()
  if (r.includes('high')) return <span className="badge badge-high">High</span>
  if (r.includes('moderate')) return <span className="badge badge-moderate">Moderate</span>
  return <span className="badge badge-low">Low</span>
}

function getScoreColor(score) {
  if (score >= 70) return '#4ade80'
  if (score >= 40) return '#facc15'
  return '#f87171'
}

function SkeletonRow() {
  return (
    <tr>
      {[140, 90, 70, 60, 80, 60].map((w, i) => (
        <td key={i} style={{ padding: '12px 16px' }}>
          <div className="skeleton" style={{ width: w, height: 12, borderRadius: 3 }} />
        </td>
      ))}
    </tr>
  )
}

export default function Dashboard() {
  const [airstrips, setAirstrips] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const controller = new AbortController()
    async function fetchData() {
      try {
        const res = await fetch('/api/airstrips', { signal: controller.signal })
        if (!res.ok) throw new Error('Non-OK response')
        const json = await res.json()
        const features = json.features ?? json
        setAirstrips(Array.isArray(features) ? features : MOCK_AIRSTRIPS)
      } catch (err) {
        if (err.name !== 'AbortError') {
          setAirstrips(MOCK_AIRSTRIPS)
        }
      } finally {
        setLoading(false)
      }
    }
    fetchData()
    return () => controller.abort()
  }, [])

  const props = airstrips.map((f) => f.properties)
  const totalAirstrips = airstrips.length
  const highViability = props.filter((p) => p.feasibility?.score >= 70).length
  const statesCovered = new Set(props.map((p) => p.state)).size
  const avgRunway = props.length
    ? Math.round(props.reduce((s, p) => s + (p.runway_length_m || 0), 0) / props.length)
    : 0

  const topFive = [...airstrips]
    .sort((a, b) => (b.properties.feasibility?.score ?? 0) - (a.properties.feasibility?.score ?? 0))
    .slice(0, 5)

  function handleRefresh() {
    setLoading(true)
    setAirstrips([])
    setTimeout(() => {
      setAirstrips(MOCK_AIRSTRIPS)
      setLoading(false)
    }, 800)
  }

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Regional airstrip intelligence overview</p>
        </div>
        <button className="btn btn-outlined" onClick={handleRefresh}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M13.5 2.5A7 7 0 1 0 14.5 9" />
            <polyline points="14,1 14,5 10,5" />
          </svg>
          Refresh Data
        </button>
      </div>

      {/* Stat cards */}
      <div className="stat-cards-row">
        <StatCard
          loading={loading}
          value={totalAirstrips}
          label="Total Airstrips"
          icon={
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="1" y="1" width="6" height="6" rx="1" />
              <rect x="9" y="1" width="6" height="6" rx="1" />
              <rect x="1" y="9" width="6" height="6" rx="1" />
              <rect x="9" y="9" width="6" height="6" rx="1" />
            </svg>
          }
        />
        <StatCard
          loading={loading}
          value={highViability}
          label="High Viability Airstrips"
          icon={
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="8" cy="8" r="6.5" />
              <polyline points="5,8.5 7,10.5 11,6" />
            </svg>
          }
        />
        <StatCard
          loading={loading}
          value={statesCovered}
          label="States Covered"
          icon={
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <polygon points="1,3 6,1 10,3 15,1 15,13 10,15 6,13 1,15" />
              <line x1="6" y1="1" x2="6" y2="13" />
              <line x1="10" y1="3" x2="10" y2="15" />
            </svg>
          }
        />
        <StatCard
          loading={loading}
          value={`${avgRunway}m`}
          label="Avg Runway Length"
          icon={
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1="1" y1="8" x2="15" y2="8" />
              <line x1="1" y1="5" x2="1" y2="11" />
              <line x1="15" y1="5" x2="15" y2="11" />
              <line x1="5" y1="6" x2="5" y2="10" />
              <line x1="8" y1="6" x2="8" y2="10" />
              <line x1="11" y1="6" x2="11" y2="10" />
            </svg>
          }
        />
      </div>

      {/* Main grid: table + top performers */}
      <div className="dashboard-grid">
        {/* Airstrip data table */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">Airstrip Registry</span>
            <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
              {loading ? '—' : `${airstrips.length} records`}
            </span>
          </div>
          <div className="panel-body" style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>State</th>
                  <th>Surface</th>
                  <th>Runway (m)</th>
                  <th>Score</th>
                  <th>Rating</th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
                  : airstrips.map((f) => {
                      const p = f.properties
                      const score = p.feasibility?.score ?? 0
                      const color = getScoreColor(score)
                      return (
                        <tr key={p.id}>
                          <td className="col-name">{p.name}</td>
                          <td>{p.state}</td>
                          <td style={{ color: 'var(--subheading)' }}>{p.surface}</td>
                          <td className="col-mono">{p.runway_length_m?.toLocaleString() ?? '—'}</td>
                          <td>
                            <div className="score-wrap">
                              <div className="score-num">{score}</div>
                              <div className="score-bar-track">
                                <div
                                  className="score-bar-fill"
                                  style={{ width: `${score}%`, background: color }}
                                />
                              </div>
                            </div>
                          </td>
                          <td>{getRatingBadge(p.feasibility?.rating)}</td>
                        </tr>
                      )
                    })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top performers */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">Top Performing</span>
            <span style={{ fontSize: 12, color: 'var(--text-2)' }}>by feasibility score</span>
          </div>
          <div className="panel-body">
            {loading ? (
              <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="skeleton" style={{ height: 14, borderRadius: 3 }} />
                ))}
              </div>
            ) : (
              <div className="top-list">
                {topFive.map((f, idx) => {
                  const p = f.properties
                  const score = p.feasibility?.score ?? 0
                  return (
                    <div key={p.id} className="top-list-item">
                      <span className="rank-num">#{idx + 1}</span>
                      <span className="rank-name" title={p.name}>{p.name}</span>
                      <div className="rank-score-wrap">
                        <span className="rank-score-num">{score}</span>
                        <div className="rank-bar-track">
                          <div className="rank-bar-fill" style={{ width: `${score}%` }} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* State distribution mini-table */}
          {!loading && (
            <div style={{ borderTop: '1px solid var(--border)', padding: '14px 20px' }}>
              <div className="detail-section-label" style={{ marginBottom: 8 }}>State Distribution</div>
              {(() => {
                const stateCounts = {}
                airstrips.forEach((f) => {
                  const s = f.properties.state
                  stateCounts[s] = (stateCounts[s] || 0) + 1
                })
                return Object.entries(stateCounts).slice(0, 5).map(([state, count]) => (
                  <div key={state} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0' }}>
                    <span style={{ color: 'var(--text)' }}>{state}</span>
                    <span style={{ fontFamily: 'var(--mono)', color: 'var(--subheading)', fontSize: 11 }}>{count}</span>
                  </div>
                ))
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Map placeholder */}
      <div
        className="map-placeholder"
        onClick={() => navigate('/map')}
        style={{ cursor: 'pointer', marginBottom: 8 }}
        title="Go to full map"
      >
        <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.2">
          <polygon points="2,6 12,2 20,6 30,2 30,26 20,30 12,26 2,30" />
          <line x1="12" y1="2" x2="12" y2="26" />
          <line x1="20" y1="6" x2="20" y2="30" />
          <circle cx="16" cy="14" r="3" />
        </svg>
        <div className="map-placeholder-label">Interactive Map — navigate to Airstrips Map for full view</div>
        <div className="map-placeholder-sub">Click to open map view →</div>
      </div>
    </div>
  )
}
