import { useState, useEffect, useMemo } from 'react'
import { MOCK_AIRSTRIPS } from '../data/mockData'

export default function Analytics() {
  const [airstrips, setAirstrips] = useState([])
  const [loading, setLoading] = useState(true)

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

  const props = airstrips.map((f) => f.properties)

  const viabilityCounts = useMemo(() => {
    let high = 0, moderate = 0, low = 0
    props.forEach((p) => {
      const s = p.feasibility?.score ?? 0
      if (s >= 70) high++
      else if (s >= 40) moderate++
      else low++
    })
    return { high, moderate, low }
  }, [props])

  const surfaceCounts = useMemo(() => {
    const counts = {}
    props.forEach((p) => {
      counts[p.surface] = (counts[p.surface] || 0) + 1
    })
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [props])

  const maxSurface = surfaceCounts.length ? Math.max(...surfaceCounts.map(([, v]) => v)) : 1

  const stateCounts = useMemo(() => {
    const counts = {}
    props.forEach((p) => {
      counts[p.state] = (counts[p.state] || 0) + 1
    })
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [props])

  const ownershipCounts = useMemo(() => {
    const counts = {}
    props.forEach((p) => {
      counts[p.ownership] = (counts[p.ownership] || 0) + 1
    })
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [props])

  const scoreDistribution = useMemo(() => {
    const bins = [
      { label: '0–19', min: 0, max: 19 },
      { label: '20–39', min: 20, max: 39 },
      { label: '40–59', min: 40, max: 59 },
      { label: '60–79', min: 60, max: 79 },
      { label: '80–100', min: 80, max: 100 },
    ]
    return bins.map((b) => ({
      ...b,
      count: props.filter((p) => {
        const s = p.feasibility?.score ?? 0
        return s >= b.min && s <= b.max
      }).length,
    }))
  }, [props])

  const maxScoreDist = scoreDistribution.length ? Math.max(...scoreDistribution.map((b) => b.count)) : 1

  function SkeletonBlock({ h }) {
    return <div className="skeleton" style={{ height: h, borderRadius: 4 }} />
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Analytics</h1>
          <p className="page-subtitle">Airstrip data distribution and coverage metrics</p>
        </div>
      </div>

      {/* Viability overview cards */}
      <div className="viability-cards">
        <div className="viability-card">
          {loading
            ? <SkeletonBlock h={38} />
            : <>
                <div className="viability-num" style={{ color: '#4ade80' }}>{viabilityCounts.high}</div>
                <div className="viability-label">High Viability</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-2)', marginTop: 2 }}>Score ≥ 70</div>
              </>
          }
        </div>
        <div className="viability-card">
          {loading
            ? <SkeletonBlock h={38} />
            : <>
                <div className="viability-num" style={{ color: '#facc15' }}>{viabilityCounts.moderate}</div>
                <div className="viability-label">Moderate Viability</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-2)', marginTop: 2 }}>Score 40–69</div>
              </>
          }
        </div>
        <div className="viability-card">
          {loading
            ? <SkeletonBlock h={38} />
            : <>
                <div className="viability-num" style={{ color: '#f87171' }}>{viabilityCounts.low}</div>
                <div className="viability-label">Low Viability</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-2)', marginTop: 2 }}>Score &lt; 40</div>
              </>
          }
        </div>
      </div>

      {/* Charts row */}
      <div className="analytics-grid">
        {/* Surface distribution */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">Surface Type Distribution</span>
          </div>
          <div style={{ padding: '18px 22px' }}>
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="skeleton" style={{ height: 12, marginBottom: 14, borderRadius: 3, width: `${70 + Math.random() * 30}%` }} />
                ))
              : surfaceCounts.map(([surface, count]) => (
                  <div key={surface} className="horiz-bar-wrap">
                    <div className="horiz-bar-label-row">
                      <span>{surface}</span>
                      <span className="horiz-bar-count">{count} airstrip{count !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="horiz-bar-track">
                      <div
                        className="horiz-bar-fill"
                        style={{ width: `${(count / maxSurface) * 100}%` }}
                      />
                    </div>
                  </div>
                ))
            }
          </div>
        </div>

        {/* Score distribution */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">Score Distribution</span>
          </div>
          <div style={{ padding: '18px 22px' }}>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="skeleton" style={{ height: 12, marginBottom: 14, borderRadius: 3, width: `${50 + Math.random() * 40}%` }} />
                ))
              : scoreDistribution.map((bin) => (
                  <div key={bin.label} className="horiz-bar-wrap">
                    <div className="horiz-bar-label-row">
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{bin.label}</span>
                      <span className="horiz-bar-count">{bin.count}</span>
                    </div>
                    <div className="horiz-bar-track">
                      <div
                        className="horiz-bar-fill"
                        style={{
                          width: maxScoreDist ? `${(bin.count / maxScoreDist) * 100}%` : '0%',
                          background: bin.min >= 70 ? '#22c55e' : bin.min >= 40 ? '#eab308' : '#ef4444',
                        }}
                      />
                    </div>
                  </div>
                ))
            }
          </div>
        </div>
      </div>

      {/* State coverage + ownership tables */}
      <div className="analytics-grid">
        {/* State coverage */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">State Coverage</span>
            <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
              {loading ? '—' : `${stateCounts.length} states`}
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>State</th>
                  <th>Airstrips</th>
                  <th>Avg Score</th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        {[20, 110, 50, 60].map((w, j) => (
                          <td key={j} style={{ padding: '10px 16px' }}>
                            <div className="skeleton" style={{ width: w, height: 11, borderRadius: 3 }} />
                          </td>
                        ))}
                      </tr>
                    ))
                  : stateCounts.map(([state, count], idx) => {
                      const stateAirstrips = props.filter((p) => p.state === state)
                      const avgScore = stateAirstrips.length
                        ? Math.round(stateAirstrips.reduce((s, p) => s + (p.feasibility?.score ?? 0), 0) / stateAirstrips.length)
                        : 0
                      return (
                        <tr key={state}>
                          <td style={{ color: 'var(--text-2)', fontFamily: 'var(--mono)', fontSize: 12 }}>{idx + 1}</td>
                          <td className="col-name">{state}</td>
                          <td className="col-mono">{count}</td>
                          <td>
                            <span
                              className="col-mono"
                              style={{
                                color: avgScore >= 70 ? '#4ade80' : avgScore >= 40 ? '#facc15' : '#f87171',
                              }}
                            >
                              {avgScore}
                            </span>
                          </td>
                        </tr>
                      )
                    })
                }
              </tbody>
            </table>
          </div>
        </div>

        {/* Ownership breakdown */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">Ownership Breakdown</span>
          </div>
          <div style={{ padding: '18px 22px' }}>
            {loading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="skeleton" style={{ height: 12, marginBottom: 14, borderRadius: 3 }} />
                ))
              : ownershipCounts.map(([owner, count]) => {
                  const pct = props.length ? Math.round((count / props.length) * 100) : 0
                  return (
                    <div key={owner} className="horiz-bar-wrap">
                      <div className="horiz-bar-label-row">
                        <span>{owner}</span>
                        <span className="horiz-bar-count">{count} ({pct}%)</span>
                      </div>
                      <div className="horiz-bar-track">
                        <div className="horiz-bar-fill" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })
            }

            {!loading && (
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                <div className="detail-section-label" style={{ marginBottom: 10 }}>Utility Availability</div>
                {[
                  ['Night Landing', props.filter((p) => p.night_landing).length],
                  ['Fuel Available', props.filter((p) => p.fuel_available).length],
                  ['EV Charging', props.filter((p) => p.charging_available).length],
                ].map(([label, count]) => (
                  <div key={label} className="horiz-bar-wrap">
                    <div className="horiz-bar-label-row">
                      <span>{label}</span>
                      <span className="horiz-bar-count">
                        {count}/{props.length}
                      </span>
                    </div>
                    <div className="horiz-bar-track">
                      <div
                        className="horiz-bar-fill"
                        style={{ width: props.length ? `${(count / props.length) * 100}%` : '0%' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
