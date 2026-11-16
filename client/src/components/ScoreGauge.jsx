export default function ScoreGauge({ score = 0, size = 48 }) {
  const radius = size * 0.4;
  const stroke = 4;
  const circumference = 2 * Math.PI * radius;
  const fill = (Math.max(0, Math.min(100, score)) / 100) * circumference;
  return (
    <svg width={size} height={size} viewBox={} aria-label={}>
      <circle cx={size/2} cy={size/2} r={radius} stroke="var(--border)" strokeWidth={stroke} fill="none" />
      <circle cx={size/2} cy={size/2} r={radius} stroke="var(--accent)" strokeWidth={stroke} fill="none" strokeDasharray={} strokeLinecap="round" transform={} />
      <text x="50%" y="54%" textAnchor="middle" dominantBaseline="middle" fill="var(--text)" fontSize="11" fontFamily="var(--font-mono)" fontWeight="700">{score}</text>
    </svg>
  );
}
