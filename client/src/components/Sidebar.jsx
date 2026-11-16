import { NavLink, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const NAV_ITEMS = [
  {
    to: '/',
    end: true,
    label: 'Overview',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7">
        <rect x="2.5" y="2.5" width="6" height="6" rx="1.2" />
        <rect x="11.5" y="2.5" width="6" height="6" rx="1.2" />
        <rect x="2.5" y="11.5" width="6" height="6" rx="1.2" />
        <rect x="11.5" y="11.5" width="6" height="6" rx="1.2" />
      </svg>
    ),
  },
  {
    to: '/map',
    label: 'Aeronautical Map',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7">
        <circle cx="10" cy="10" r="7.5" />
        <polygon points="12.8,7.2 11.1,11.1 7.2,12.8 8.9,8.9" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    to: '/analytics',
    label: 'Fleet Deployments',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7">
        <path d="M2.5 14.5h15" strokeLinecap="round" />
        <path d="M4.5 11.5l3.2-2.2 2.4-4.8 1.6 1.2-1 3.6 3.8-1.4 2 1.2-6.2 3.3-5.8-.9z" />
      </svg>
    ),
  },
  {
    to: '/regions',
    label: 'Airstrip Directory',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7">
        <rect x="3" y="3.5" width="14" height="4" rx="1" />
        <rect x="3" y="9.5" width="14" height="4" rx="1" />
        <circle cx="6" cy="5.5" r="0.8" fill="currentColor" />
        <circle cx="6" cy="11.5" r="0.8" fill="currentColor" />
        <path d="M5 16.5h10" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    to: '/reports',
    label: 'Simulation Dossier',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7">
        <rect x="3.5" y="2.5" width="13" height="15" rx="1.5" />
        <line x1="7" y1="13" x2="7" y2="9" strokeLinecap="round" />
        <line x1="10" y1="13" x2="10" y2="6.5" strokeLinecap="round" />
        <line x1="13" y1="13" x2="13" y2="10.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    to: '/world-map',
    label: 'Global Grid',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7">
        <circle cx="10" cy="10" r="7.5" />
        <ellipse cx="10" cy="10" rx="3.4" ry="7.5" />
        <line x1="2.5" y1="10" x2="17.5" y2="10" />
      </svg>
    ),
  },
]

export default function Sidebar({ open = false, onClose }) {
  const { currentUser, switchRole } = useAuth()
  const activeRole = currentUser?.role || 'viewer'

  return (
    <aside
      className={`stitch-sidebar${open ? ' stitch-sidebar-open' : ''}`}
      aria-label="Primary Workstation Navigation"
    >
      <div className="stitch-sidebar-top">
        <div className="stitch-sidebar-brand-bar">
          <div className="stitch-brand-group">
            <div className="stitch-brand-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="8.5" />
                <circle cx="12" cy="12" r="4" />
                <line x1="12" y1="2" x2="12" y2="6" />
                <line x1="12" y1="18" x2="12" y2="22" />
                <line x1="2" y1="12" x2="6" y2="12" />
                <line x1="18" y1="12" x2="22" y2="12" />
                <circle cx="12" cy="12" r="1.4" fill="currentColor" />
              </svg>
            </div>
            <div className="stitch-brand-titles">
              <div className="stitch-brand-name">AeroGrid</div>
              <div className="stitch-brand-sub">TACTICAL MFD</div>
            </div>
          </div>
          <span className="stitch-version-pill">v4.2</span>
        </div>

        <div className="stitch-nav-section-label">Avionics Command</div>

        <nav className="stitch-sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onClose}
              className={({ isActive }) => `stitch-nav-item${isActive ? ' active' : ''}`}
            >
              <span className="stitch-nav-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="stitch-sidebar-footer">
        <div className="stitch-telemetry-card">
          <div className="stitch-telemetry-head">
            <span className="stitch-telemetry-kicker">NAV TELEMETRY</span>
            <span className="stitch-telemetry-lock">
              <span className="stitch-pip stitch-pip-green" aria-hidden="true" />
              LOCKED
            </span>
          </div>
          <div className="stitch-telemetry-row">
            <span>Constellation</span>
            <span className="stitch-telemetry-val">NavIC / GPS</span>
          </div>
          <div className="stitch-telemetry-row">
            <span>Precision Alt</span>
            <span className="stitch-telemetry-val">±0.28m MSL</span>
          </div>
        </div>

        <div className="stitch-ops-box">
          <div className="stitch-ops-head">
            <span className="stitch-ops-name">{currentUser?.name || 'Unauthenticated'}</span>
            <span className={`stitch-role-pill stitch-role-${activeRole}`}>{activeRole.toUpperCase()}</span>
          </div>
          <div className="stitch-demo-label">Demo mode</div>
          <div className="stitch-role-switcher" role="group" aria-label="Demo mode: switch operator role">
            {['admin', 'analyst', 'viewer'].map((role) => (
              <button
                key={role}
                type="button"
                className={`stitch-role-btn${activeRole === role ? ' active' : ''}`}
                aria-pressed={activeRole === role}
                onClick={() => switchRole(role)}
              >
                {role}
              </button>
            ))}
          </div>
          <div className="stitch-ops-links">
            <Link to="/login" className="stitch-ops-link" onClick={onClose}>
              Operator Terminal
            </Link>
            <span className="stitch-ops-datum">SRID 4326</span>
          </div>
        </div>
      </div>
    </aside>
  )
}
