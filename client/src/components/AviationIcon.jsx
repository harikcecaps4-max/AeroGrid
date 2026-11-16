export default function AviationIcon({ type = 'evtol', size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <path d="M12 2v20M2 12h20M4 9l16 6M4 15l16-6" />
    </svg>
  );
}
