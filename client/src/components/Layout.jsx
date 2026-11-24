import { useState } from 'react'
import { Outlet, Link } from 'react-router-dom'
import Sidebar from './Sidebar'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../theme/ThemeContext'

export default function Layout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [globalSearch, setGlobalSearch] = useState('')
  const { currentUser, token } = useAuth()
  const { theme, setTheme } = useTheme()

  const isSignedIn = Boolean(token && currentUser)
  const operatorName = isSignedIn
    ? currentUser.name || currentUser.email || 'Signed In'
    : 'Not signed in'
  const operatorRoleLabel = isSignedIn
    ? String(currentUser.role || 'viewer').toUpperCase()
    : 'Sign In'

  return (
    <div className="stitch-shell">
      <Sidebar open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      {mobileNavOpen && (
        <div
          className="stitch-sidebar-backdrop"
          onClick={() => setMobileNavOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="stitch-main-column">
        <header className="stitch-topbar">
          <div className="stitch-topbar-left">
            <button
              type="button"
              className="stitch-mobile-menu-btn"
              onClick={() => setMobileNavOpen((prev) => !prev)}
              aria-label="Toggle navigation rail"
              aria-expanded={mobileNavOpen}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8">
                <line x1="2" y1="4.5" x2="16" y2="4.5" />
                <line x1="2" y1="9" x2="16" y2="9" />
                <line x1="2" y1="13.5" x2="16" y2="13.5" />
              </svg>
            </button>

            <div className="stitch-search-wrap">
              <svg
                className="stitch-search-icon"
                width="16"
                height="16"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <circle cx="9" cy="9" r="6" />
                <line x1="13.5" y1="13.5" x2="17.5" y2="17.5" strokeLinecap="round" />
              </svg>
              <input
                type="search"
                className="stitch-search-input"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="Search Indian Aerodromes, ICAO/IATA (e.g. VIDP, VOBL), Vertipads..."
                aria-label="Search aerodromes, ICAO codes, or vertipads"
              />
            </div>
          </div>

          <div className="stitch-topbar-right">
            <div className="stitch-sync-chip">
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M13 3l4 4-2.5 2.5-4-4L13 3z" />
                <path d="M10.5 5.5L5.5 10.5l4 4 5-5" />
                <path d="M3 15a4 4 0 0 0 4 2" />
              </svg>
              <span>GNSS/NAVIC</span>
              <strong>99.98% SYNC</strong>
            </div>

            <Link to="/map" className="stitch-sector-chip" title="Open live sector map">
              <span className="stitch-pip stitch-pip-green" aria-hidden="true" />
              <span>SEC-DEL-BLR LIVE</span>
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <polyline points="6 8 10 12 14 8" />
              </svg>
            </Link>

            <div className="stitch-theme-pill" role="group" aria-label="Display theme">
              <button
                type="button"
                className={`stitch-theme-opt${theme === 'light' ? ' active' : ''}`}
                aria-pressed={theme === 'light'}
                onClick={() => setTheme('light')}
                title="Light chart theme"
              >
                <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
                  <circle cx="10" cy="10" r="3.5" />
                  <path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M15.3 4.7l-1.4 1.4M6.1 13.9l-1.4 1.4" strokeLinecap="round" />
                </svg>
                LIGHT
              </button>
              <button
                type="button"
                className={`stitch-theme-opt${theme === 'dark' ? ' active' : ''}`}
                aria-pressed={theme === 'dark'}
                onClick={() => setTheme('dark')}
                title="Dark titanium theme"
              >
                <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
                  <path d="M16.5 11.5A7 7 0 0 1 8.5 3.5a7 7 0 1 0 8 8z" strokeLinejoin="round" />
                </svg>
                DARK
              </button>
            </div>

            <div className="stitch-icon-actions">
              <Link to="/reports" className="stitch-icon-btn" aria-label="Notifications and audit manifests" title="View Audit Manifests">
                <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <path d="M15 7a5 5 0 0 0-10 0c0 4.5-2 5.5-2 5.5h14S15 11.5 15 7" />
                  <path d="M8.5 16a1.8 1.8 0 0 0 3 0" />
                </svg>
                <span className="stitch-alert-dot" aria-hidden="true" />
              </Link>
              <Link to="/analytics" className="stitch-icon-btn" aria-label="Operational fleet analytics" title="Fleet Deployments">
                <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <circle cx="10" cy="10" r="7" />
                  <line x1="10" y1="6.5" x2="10" y2="10.5" strokeLinecap="round" />
                  <circle cx="10" cy="13.5" r="0.8" fill="currentColor" />
                </svg>
              </Link>
            </div>

            <Link to="/login" className="stitch-operator-chip" title="Open Operator Terminal">
              <div className="stitch-operator-meta">
                <span className="stitch-operator-name">{operatorName}</span>
                <span className="stitch-operator-role">{operatorRoleLabel}</span>
              </div>
              <div className="stitch-operator-avatar" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="10" cy="7" r="3.2" />
                  <path d="M4 16.8a6 6 0 0 1 12 0" strokeLinecap="round" />
                </svg>
                <span className="stitch-avatar-online" />
              </div>
            </Link>
          </div>
        </header>

        <main className="main-content stitch-main-content">
          <Outlet context={{ globalSearch, setGlobalSearch }} />
        </main>
      </div>
    </div>
  )
}
