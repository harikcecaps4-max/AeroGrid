export default function DataSourceBadge({ source, loading = false, className = '' }) {
  let label = 'Checking...'
  let dotColor = 'var(--text-muted)'

  if (!loading) {
    if (source === 'database') {
      label = 'Live database'
      dotColor = 'var(--viable)'
    } else if (source === 'fallback') {
      label = 'Fallback data'
      dotColor = 'var(--conditional)'
    } else if (source === 'unavailable') {
      label = 'Service unavailable'
      dotColor = 'var(--not-viable)'
    }
  }

  return (
    <span
      role="status"
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 10px',
        borderRadius: '999px',
        fontSize: '0.72rem',
        fontWeight: 600,
        letterSpacing: '0.03em',
        background: 'var(--surface-raised)',
        border: '1px solid var(--border)',
        color: 'var(--text)',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: '7px',
          height: '7px',
          borderRadius: '50%',
          backgroundColor: dotColor,
          flexShrink: 0,
        }}
      />
      <span>{label}</span>
    </span>
  )
}
