export default function Reports() {
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">Automated analysis and export</p>
        </div>
        <button className="btn btn-outlined">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M8 2v9M5 8l3 3 3-3" />
            <path d="M2 13h12" />
          </svg>
          Export PDF
        </button>
      </div>
      <div className="panel" style={{ padding: '40px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: 'var(--text-2)' }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" style={{ opacity: 0.3 }}>
          <rect x="3" y="2" width="18" height="20" rx="2" />
          <line x1="7" y1="7" x2="17" y2="7" />
          <line x1="7" y1="11" x2="17" y2="11" />
          <line x1="7" y1="15" x2="13" y2="15" />
        </svg>
        <div style={{ fontSize: 14, color: 'var(--text-2)' }}>Reports module coming soon</div>
        <div style={{ fontSize: 12, color: 'var(--text-2)', opacity: 0.7 }}>Scheduled PDF/CSV exports and automated feasibility summaries will appear here.</div>
      </div>
    </div>
  )
}
