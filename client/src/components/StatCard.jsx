export default function StatCard({ icon, value, label, meta, status = 'vector', loading }) {
  return (
    <div className={`stat-card stat-border-${status}`}>
      <div className="stat-card-top">
        <div className="stat-label">{label}</div>
        <div className="stat-card-icon" aria-hidden="true">{icon}</div>
      </div>
      {loading ? (
        <>
          <div className="skeleton" style={{ width: '80px', height: '30px', marginTop: '6px' }} />
          <div className="skeleton" style={{ width: '120px', height: '12px', marginTop: '8px' }} />
        </>
      ) : (
        <>
          <div className="stat-value tabular-num">{value}</div>
          {meta && <div className="stat-trend">{meta}</div>}
        </>
      )}
    </div>
  )
}
