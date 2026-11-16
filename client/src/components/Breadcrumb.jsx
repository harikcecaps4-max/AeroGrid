export default function Breadcrumb({ items = [] }) {
  return (
    <nav className="stitch-breadcrumb" aria-label="Breadcrumb">
      {items.map((it, idx) => (
        <span key={it.label} className="stitch-breadcrumb-item">
          {idx > 0 && <span className="meta-divider">/</span>}
          {it.href ? <a href={it.href}>{it.label}</a> : <span>{it.label}</span>}
        </span>
      ))}
    </nav>
  );
}
