export default function StatCard({ icon, value, label, loading }) {
  return (
    <div className="stat-card">
      <div className="stat-card-icon">{icon}</div>
      {loading ? (
        <>
          <div className="skeleton" style={{ width: '80px', height: '30px', marginTop: '4px', borderRadius: '4px' }} />
          <div className="skeleton" style={{ width: '120px', height: '12px', marginTop: '8px', borderRadius: '3px' }} />
        </>
      ) : (
        <>
          <div className="stat-value">{value}</div>
          <div className="stat-label">{label}</div>
        </>
      )}
    </div>
  )
}
