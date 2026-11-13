import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { currentUser, loginWithCredentials, switchRole, availableUsers } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState(currentUser?.email || 'analyst@aerogrid.dev')
  const [password, setPassword] = useState('aerogrid-ops')
  const [rolePreset, setRolePreset] = useState(currentUser?.role || 'analyst')
  const [submitting, setSubmitting] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [apiState, setApiState] = useState('checking')

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/health', { signal: controller.signal })
      .then((res) => setApiState(res.ok ? 'online' : 'offline'))
      .catch(() => setApiState('offline'))
    return () => controller.abort()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim()) {
      setStatusMsg('Operator identifier email is required.')
      return
    }
    setSubmitting(true)
    setStatusMsg('')
    try {
      await loginWithCredentials(email, password, rolePreset)
      navigate('/map')
    } finally {
      setSubmitting(false)
    }
  }

  function handlePresetLaunch(user) {
    switchRole(user.role)
    navigate('/map')
  }

  return (
    <div className="login-viewport">
      <div className="login-grid">
        {/* Left: Operations Specification & Telemetry */}
        <section className="login-brief" aria-label="AeroGrid Platform Specifications">
          <div className="login-brand-bar">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="login-reticle">
              <circle cx="12" cy="12" r="9" />
              <line x1="12" y1="1.5" x2="12" y2="6.5" />
              <line x1="12" y1="17.5" x2="12" y2="22.5" />
              <line x1="1.5" y1="12" x2="6.5" y2="12" />
              <line x1="17.5" y1="12" x2="22.5" y2="12" />
              <circle cx="12" cy="12" r="2.2" fill="currentColor" />
            </svg>
            <div>
              <h1 className="login-wordmark">AeroGrid Intelligence</h1>
              <div className="login-subline">Regional Micro-Airstrip GIS &amp; Fleet Deployment Console</div>
            </div>
          </div>

          <p className="login-summary">
            Geospatial feasibility workstation for eVTOL, STOL, and regional turboprop operators evaluating runway geometry, ground access, hub connectivity, and jurisdictional stability across Indian regional sectors.
          </p>

          <div className="login-spec-table" role="table" aria-label="Sector Index Parameters">
            <div className="login-spec-row">
              <span className="login-spec-key">Spatial Reference</span>
              <span className="login-spec-val">WGS-84 / EPSG:4326 (PostGIS GiST)</span>
            </div>
            <div className="login-spec-row">
              <span className="login-spec-key">Indexed Sectors</span>
              <span className="login-spec-val">25 Indian Micro-Airstrips | 10 Hub Airports</span>
            </div>
            <div className="login-spec-row">
              <span className="login-spec-key">Scoring Model</span>
              <span className="login-spec-val">100-pt Runway, Surface, Utilities &amp; Political Risk</span>
            </div>
            <div className="login-spec-row">
              <span className="login-spec-key">Telemetry Link</span>
              <span className="login-spec-val">
                <span className={`ops-dot ${apiState === 'online' ? 'dot-ok' : apiState === 'offline' ? 'dot-warn' : 'dot-idle'}`} />
                {apiState === 'online'
                  ? 'API Connected (Live PostGIS)'
                  : apiState === 'offline'
                  ? 'Local Sector Cache Active'
                  : 'Probing Endpoint...'}
              </span>
            </div>
          </div>

          <div className="login-runway-diagram" aria-hidden="true">
            <svg viewBox="0 0 420 56" width="100%" height="56">
              <line x1="12" y1="28" x2="408" y2="28" stroke="#1E2E46" strokeWidth="1" />
              <rect x="44" y="12" width="332" height="32" fill="#0B121E" stroke="#2B4162" strokeWidth="1" />
              <text x="54" y="32" fill="#8A9BB5" fontSize="11" fontFamily="IBM Plex Sans, sans-serif" fontWeight="600">09</text>
              <line x1="82" y1="28" x2="338" y2="28" stroke="#0EA5E9" strokeWidth="1.5" strokeDasharray="8 6" />
              <text x="350" y="32" fill="#8A9BB5" fontSize="11" fontFamily="IBM Plex Sans, sans-serif" fontWeight="600">27</text>
            </svg>
          </div>
        </section>

        {/* Right: Operator Authentication Console */}
        <section className="login-console" aria-label="Operator Sign-In Form">
          <div className="login-console-header">
            <h2 className="login-console-title">Operator Authentication</h2>
            <span className="clearance-pill">RBAC TERMINAL</span>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <div className="field-group">
              <label htmlFor="ops-email" className="field-label">Operator Email</label>
              <input
                id="ops-email"
                type="email"
                className="ops-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operator@aerogrid.dev"
                autoComplete="email"
                required
              />
            </div>

            <div className="field-group">
              <label htmlFor="ops-password" className="field-label">Access Passkey</label>
              <input
                id="ops-password"
                type="password"
                className="ops-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter workstation passkey"
                autoComplete="current-password"
              />
            </div>

            <div className="field-group">
              <label htmlFor="ops-role" className="field-label">Fallback Clearance Level</label>
              <select
                id="ops-role"
                className="ops-input"
                value={rolePreset}
                onChange={(e) => setRolePreset(e.target.value)}
              >
                <option value="admin">Admin — Full Registry, Political Risk &amp; Asset Control</option>
                <option value="analyst">Analyst — Route Evaluation &amp; Asset Logging</option>
                <option value="viewer">Viewer — Read-Only Sector Inspection</option>
              </select>
            </div>

            {statusMsg && (
              <div className="login-error" role="alert">
                {statusMsg}
              </div>
            )}

            <button type="submit" className="btn btn-primary login-submit-btn" disabled={submitting}>
              {submitting ? 'Authenticating Session...' : 'Open Sector Workstation'}
            </button>
          </form>

          <div className="login-presets">
            <div className="login-presets-title">Quick Clearance Switch</div>
            <div className="login-presets-grid">
              {availableUsers.map((u) => (
                <button
                  key={u.role}
                  type="button"
                  className={`preset-btn${currentUser?.role === u.role ? ' preset-active' : ''}`}
                  onClick={() => handlePresetLaunch(u)}
                >
                  <span className="preset-role">{u.role.toUpperCase()}</span>
                  <span className="preset-name">{u.name}</span>
                  <span className="preset-station">{u.station}</span>
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

