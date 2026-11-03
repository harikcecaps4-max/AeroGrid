import { NavLink } from 'react-router-dom'

const NAV_ITEMS = [
  {
    to: '/',
    end: true,
    label: 'Dashboard',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="1" y="1" width="6" height="6" rx="1" />
        <rect x="9" y="1" width="6" height="6" rx="1" />
        <rect x="1" y="9" width="6" height="6" rx="1" />
        <rect x="9" y="9" width="6" height="6" rx="1" />
      </svg>
    ),
  },
  {
    to: '/map',
    label: 'Airstrips Map',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <polygon points="1,3 6,1 10,3 15,1 15,13 10,15 6,13 1,15" />
        <line x1="6" y1="1" x2="6" y2="13" />
        <line x1="10" y1="3" x2="10" y2="15" />
      </svg>
    ),
  },
  {
    to: '/world-map',
    label: 'Global World Map',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="8" cy="8" r="7" />
        <ellipse cx="8" cy="8" rx="7" ry="3" />
        <line x1="8" y1="1" x2="8" y2="15" />
      </svg>
    ),
  },
  {
    to: '/regions',
    label: 'States & Cities',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="8" cy="8" r="6" />
        <path d="M2 8h12M8 2a10 10 0 0 1 0 12M8 2a10 10 0 0 0 0 12" />
      </svg>
    ),
  },
  {
    to: '/analytics',
    label: 'Analytics',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <polyline points="1,12 5,7 8,9 11,4 15,8" />
        <line x1="1" y1="14" x2="15" y2="14" />
      </svg>
    ),
  },
  {
    to: '/reports',
    label: 'Reports',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="1" width="12" height="14" rx="1" />
        <line x1="5" y1="5" x2="11" y2="5" />
        <line x1="5" y1="8" x2="11" y2="8" />
        <line x1="5" y1="11" x2="9" y2="11" />
      </svg>
    ),
  },
]

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-name">AeroGrid</div>
        <div className="logo-sub">Intelligence</div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-label">Navigation</div>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <span className="version-badge">v0.1.0-beta</span>
      </div>
    </aside>
  )
}
