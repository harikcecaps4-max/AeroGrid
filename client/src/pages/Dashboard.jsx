import { useState, useEffect, useMemo } from 'react'
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
  if (score >= 70) return 'var(--status-ok)'
  if (score >= 40) return 'var(--status-warn)'
  return 'var(--status-danger)'
}

function SkeletonRow() {
  return (
    <tr>
      {[150, 90, 70, 65, 85, 70, 60].map((w, i) => (
        <td key={i} style={{ padding: '12px 16px' }}>
          <div className="skeleton" style={{ width: w, height: 12 }} />
        </td>
      ))}
    </tr>
  )
}

export default function Dashboard() {
  const [airstrips, setAirstrips] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncError, setSyncError] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('score_desc')
  const navigate = useNavigate()

  async function loadRegistry(signal) {
    setLoading(true)
    setSyncError(false)
    try {
      const res = await fetch('/api/airstrips', { signal })
      if (!res.ok) throw new Error('Non-OK response')
      const json = await res.json()
      const features = json.features ?? json
      setAirstrips(Array.isArray(features) ? features : MOCK_AIRSTRIPS)
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

  const props = airstrips.map((f) => f.properties)
  const totalAirstrips = airstrips.length
  const highViability = props.filter((p) => (p.feasibility?.score ?? 0) >= 70).length
  const statesCovered = new Set(props.map((p) => p.state)).size
  const avgRunway = props.length
    ? Math.round(props.reduce((s, p) => s + (p.runway_length_m || 0), 0) / props.length)
    : 0
  const disruptedCount = props.filter((p) => (p.political_influence?.penalty_points || 0) > 0).length

  const displayedAirstrips = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const base = q
      ? airstrips.filter((f) => {
          const p = f.properties
          return (
            p.name.toLowerCase().includes(q) ||
            p.state.toLowerCase().includes(q) ||
            (p.surface || '').toLowerCase().includes(q)
          )
        })
      : [...airstrips]

    base.sort((a, b) => {
      const pa = a.properties
      const pb = b.properties
      if (sortBy === 'runway_desc') return (pb.runway_length_m || 0) - (pa.runway_length_m || 0)
      if (sortBy === 'name_asc') return pa.name.localeCompare(pb.name)
      return (pb.feasibility?.score ?? 0) - (pa.feasibility?.score ?? 0)
    })
    return base
  }, [airstrips, searchQuery, sortBy])

  const topFive = useMemo(() => {
    return [...airstrips]
      .sort((a, b) => (b.properties.feasibility?.score ?? 0) - (a.properties.feasibility?.score ?? 0))
      .slice(0, 5)
  }, [airstrips])

  const politicalWatchlist = useMemo(() => {
    return airstrips
      .filter((f) => (f.properties.political_influence?.penalty_points || 0) > 0)
      .sort(
        (a, b) =>
          (b.properties.political_influence?.penalty_points || 0) -
          (a.properties.political_influence?.penalty_points || 0)
      )
  }, [airstrips])

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Sector Registry Overview</h1>
          <p className="page-subtitle">
            {syncError
              ? 'Offline Sector Cache Active | Displaying 25 verified Indian regional micro-airstrips'
              : 'Live operational readiness index across regional micro-airstrips and commercial anchor hubs'}
          </p>
        </div>
        <div className="header-actions-row">
          <button type="button" className="btn btn-outlined" onClick={() => loadRegistry()}>
            Synchronize Telemetry
          </button>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/map')}>
            Open Sector Map
          </button>
        </div>
      </div>

      {/* Sector Readiness Readout Strip */}
      <div className="stat-cards-row">
        <StatCard
          loading={loading}
          value={totalAirstrips}
          label="Indexed Micro-Airstrips"
          meta={`${statesCovered} States Covered`}
          status="vector"
          icon={
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="1.5" y="1.5" width="5.5" height="5.5" />
              <rect x="9" y="1.5" width="5.5" height="5.5" />
              <rect x="1.5" y="9" width="5.5" height="5.5" />
              <rect x="9" y="9" width="5.5" height="5.5" />
            </svg>
          }
        />
        <StatCard
          loading={loading}
          value={highViability}
          label="Cleared High Viability"
          meta="Feasibility Score 70+"
          status="ok"
          icon={
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="8" cy="8" r="6.5" />
              <polyline points="5,8.5 7,10.5 11,6" />
            </svg>
          }
        />
        <StatCard
          loading={loading}
          value={`${avgRunway}m`}
          label="Mean Runway Length"
          meta="Min 60m eVTOL Clearance"
          status="vector"
          icon={
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1="1" y1="8" x2="15" y2="8" />
              <line x1="1" y1="5" x2="1" y2="11" />
              <line x1="15" y1="5" x2="15" y2="11" />
              <line x1="5" y1="6" x2="5" y2="10" />
              <line x1="11" y1="6" x2="11" y2="10" />
            </svg>
          }
        />
        <StatCard
          loading={loading}
          value={disruptedCount}
          label="Political Risk Alerts"
          meta="Active Score Deductions"
          status={disruptedCount > 0 ? 'warn' : 'ok'}
          icon={
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <polygon points="8,1.5 14.5,13.5 1.5,13.5" />
              <line x1="8" y1="6" x2="8" y2="9.5" />
              <circle cx="8" cy="11.5" r="0.6" fill="currentColor" />
            </svg>
          }
        />
      </div>

      {/* Main Dispatch Grid */}
      <div className="dashboard-grid">
        {/* Airstrip Registry Table */}
        <div className="panel">
          <div className="panel-header panel-header-controls">
            <div>
              <span className="panel-title">Airstrip Feasibility Registry</span>
              <span className="panel-subtitle-inline tabular-num">
                {loading ? 'Querying...' : `${displayedAirstrips.length} of ${airstrips.length} targets`}
              </span>
            </div>
            <div className="table-toolbar">
              <input
                type="search"
                className="ops-input ops-input-compact"
                placeholder="Search airstrip or state..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Filter registry table"
              />
              <select
                className="filter-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                aria-label="Sort registry table"
              >
                <option value="score_desc">Sort: Feasibility</option>
                <option value="runway_desc">Sort: Runway Length</option>
                <option value="name_asc">Sort: Name (A-Z)</option>
              </select>
            </div>
          </div>

          <div className="panel-body" style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Airstrip</th>
                  <th>State</th>
                  <th>Surface</th>
                  <th>Runway</th>
                  <th>Political Risk</th>
                  <th>Score</th>
                  <th>Tier</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
                ) : displayedAirstrips.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="empty-table-cell">
                      No indexed airstrips match &ldquo;{searchQuery}&rdquo;. Clear search to view full registry.
                    </td>
                  </tr>
                ) : (
                  displayedAirstrips.map((f) => {
                    const p = f.properties
                    const score = p.feasibility?.score ?? 0
                    const color = getScoreColor(score)
                    const pol = p.political_influence
                    const polSev = pol?.severity || 'none'
                    return (
                      <tr
                        key={p.id}
                        className="clickable-row"
                        onClick={() => navigate(`/map?strip=${p.id}`)}
                        title="Open airstrip in Sector Map readout"
                      >
                        <td className="col-name">{p.name}</td>
                        <td>{p.state}</td>
                        <td className="capitalize">{p.surface}</td>
                        <td className="col-mono tabular-num">{p.runway_length_m?.toLocaleString() ?? '0'}m</td>
                        <td>
                          <span className={`pol-badge pol-${polSev}`} title={pol?.details || 'Stable jurisdiction'}>
                            {polSev !== 'none' ? `${polSev.toUpperCase()} (-${pol?.penalty_points})` : 'STABLE'}
                          </span>
                        </td>
                        <td>
                          <div className="score-wrap">
                            <div className="score-num tabular-num">{score}</div>
                            <div className="score-bar-track">
                              <div className="score-bar-fill" style={{ width: `${score}%`, background: color }} />
                            </div>
                          </div>
                        </td>
                        <td>{getRatingBadge(p.feasibility?.rating)}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Side: Priority Candidates + Political Watchlist */}
        <div className="dashboard-side-stack">
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">Priority Deployment Candidates</span>
              <span className="panel-subtitle-inline">Top Ranked</span>
            </div>
            <div className="panel-body">
              {loading ? (
                <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="skeleton" style={{ height: 14 }} />
                  ))}
                </div>
              ) : (
                <div className="top-list">
                  {topFive.map((f, idx) => {
                    const p = f.properties
                    const score = p.feasibility?.score ?? 0
                    return (
                      <button
                        key={p.id}
                        type="button"
                        className="top-list-item top-list-btn"
                        onClick={() => navigate(`/map?strip=${p.id}`)}
                      >
                        <span className="rank-num tabular-num">{idx + 1}</span>
                        <span className="rank-name" title={p.name}>{p.name}</span>
                        <div className="rank-score-wrap">
                          <span className="rank-score-num tabular-num">{score}</span>
                          <div className="rank-bar-track">
                            <div className="rank-bar-fill" style={{ width: `${score}%` }} />
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">Political &amp; Regulatory Watchlist</span>
              <span className="panel-subtitle-inline tabular-num">{politicalWatchlist.length} Flagged</span>
            </div>
            <div className="panel-body">
              {loading ? (
                <div style={{ padding: '14px 20px' }}>
                  <div className="skeleton" style={{ height: 60 }} />
                </div>
              ) : (
                <div className="watchlist-stack">
                  {politicalWatchlist.map((f) => {
                    const p = f.properties
                    const pol = p.political_influence
                    return (
                      <button
                        key={p.id}
                        type="button"
                        className={`watchlist-row sev-strip-${pol.severity}`}
                        onClick={() => navigate(`/map?strip=${p.id}`)}
                      >
                        <div className="watchlist-row-top">
                          <span className="watchlist-name">{p.name}</span>
                          <span className={`pol-badge pol-${pol.severity} tabular-num`}>
                            -{pol.penalty_points} pts
                          </span>
                        </div>
                        <div className="watchlist-disruption">{pol.disruption_type}</div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
