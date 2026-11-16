export default function SkeletonLoader({ height = 20, width = '100%', radius = 'var(--radius-sm)' }) {
  return <div className="skeleton" style={{ height, width, borderRadius: radius }} aria-hidden="true" />;
}
