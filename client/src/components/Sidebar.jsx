import { NavLink, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const NAV_ITEMS = [
  {
    to: '/map',
    label: 'Sector Map',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <polygon points="1,3 6,1 10,3 15,1 15,13 10,15 6,13 1,15" />
        <line x1="6" y1="1" x2="6" y2="13" />
        <line x1="10" y1="3" x2="10" y2="15" />
      </svg>
    ),
  },
  {
    to: '/',
    end: true,
    label: 'Registry Overview',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="1.5" y="1.5" width="5.5" height="5.5" />
        <rect x="9" y="1.5" width="5.5" height="5.5" />
        <rect x="1.5" y="9" width="5.5" height="5.5" />
        <rect x="9" y="9" width="5.5" height="5.5" />
      </svg>
    ),
  },
  {
    to: '/world-map',
    label: 'Global Grid',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="8" cy="8" r="6.5" />
        <ellipse cx="8" cy="8" rx="6.5" ry="2.8" />
        <line x1="8" y1="1.5" x2="8" y2="14.5" />
      </svg>
    ),
  },
  {
    to: '/regions',
    label: 'States & Cities',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="8" cy="8" r="6" />
        <path d="M2 8h12M8 2a9 9 0 0 1 0 12M8 2a9 9 0 0 0 0 12" />
      </svg>
    ),
  },
  {
    to: '/analytics',
    label: 'Fleet Analytics',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <polyline points="1.5,12 5,7.5 8,9.5 11.5,4 14.5,7.5" />
        <line x1="1.5" y1="14" x2="14.5" y2="14" />
      </svg>
    ),
  },
  {
    to: '/reports',
    label: 'Audit Manifests',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2.5" y="1.5" width="11" height="13" />
        <line x1="5" y1="5" x2="11" y2="5" />
        <line x1="5" y1="8" x2="11" y2="8" />
        <line x1="5" y1="11" x2="9" y2="11" />
      </svg>
    ),
  },
]

export default function Sidebar({ open = false, onClose }) {
  const { currentUser, switchRole } = useAuth()
  const activeRole = currentUser?.role || 'viewer'

  return (
    <aside className={`sidebar${open ? ' sidebar-open' : ''}`} aria-label="Primary Workstation Navigation">
      <div className="sidebar-logo">
        <div className="sidebar-brand-row">
          <div className="brand-reticle" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="9" />
              <line x1="12" y1="2" x2="12" y2="6" />
              <line x1="12" y1="18" x2="12" y2="22" />
              <line x1="2" y1="12" x2="6" y2="12" />
              <line x1="18" y1="12" x2="22" y2="12" />
              <circle cx="12" cy="12" r="2" fill="currentColor" />
            </svg>
          </div>
          <div>
            <div className="logo-name">AeroGrid</div>
            <div className="logo-sub">Regional Airstrip GIS</div>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-label">Operations Views</div>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onClose}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="ops-identity-box">
          <div className="ops-identity-head">
            <span className="ops-identity-name">{currentUser?.name || 'Unauthenticated'}</span>
            <span className={`role-chip role-${activeRole}`}>{activeRole.toUpperCase()}</span>
          </div>
          <div className="ops-identity-email">{currentUser?.email || 'No active session'}</div>

          <div className="role-switcher" role="group" aria-label="Switch Operator Clearance">
            {['admin', 'analyst', 'viewer'].map((role) => (
              <button
                key={role}
                type="button"
                className={`role-switch-btn${activeRole === role ? ' active' : ''}`}
                onClick={() => switchRole(role)}
              >
                {role}
              </button>
            ))}
          </div>
        </div>

        <div className="sidebar-telemetry-row">
          <Link to="/login" className="ops-terminal-link" onClick={onClose}>
            Operator Terminal
          </Link>
          <span className="telemetry-datum">SRID 4326</span>
        </div>
      </div>
    </aside>
  )
}
