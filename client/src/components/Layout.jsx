import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function Layout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <div className="app-shell">
      <div className="mobile-ops-bar">
        <button
          type="button"
          className="mobile-menu-btn"
          onClick={() => setMobileNavOpen((prev) => !prev)}
          aria-label="Toggle navigation rail"
          aria-expanded={mobileNavOpen}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.75">
            <line x1="2" y1="4.5" x2="16" y2="4.5" />
            <line x1="2" y1="9" x2="16" y2="9" />
            <line x1="2" y1="13.5" x2="16" y2="13.5" />
          </svg>
        </button>
        <span className="mobile-ops-title">AeroGrid Intelligence</span>
        <span className="mobile-ops-datum">WGS-84</span>
      </div>
      <Sidebar open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      {mobileNavOpen && <div className="sidebar-backdrop" onClick={() => setMobileNavOpen(false)} aria-hidden="true" />}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}
