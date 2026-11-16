export default function StatCard({
  label,
  subtitle,
  value,
  deltaText,
  deltaPrefixIcon,
  badgeText,
  footerLeft,
  footerRight,
  variant = 'neutral', // 'neutral' | 'viable' | 'conditional' | 'nonviable'
  icon,
  meta,
  loading = false,
}) {
  return (
    <article className={`stitch-stat-card stitch-stat-${variant}`}>
      <div className="stitch-stat-top">
        <div className="stitch-stat-titles">
          <div className="stitch-stat-kicker">{label}</div>
          {subtitle && <div className={`stitch-stat-sub stitch-sub-${variant}`}>{subtitle}</div>}
        </div>

        {badgeText ? (
          <span className={`stitch-stat-pill stitch-pill-${variant}`}>
            <span className={`stitch-pip stitch-pip-${variant}`} aria-hidden="true" />
            <span>{badgeText}</span>
          </span>
        ) : icon ? (
          <div className="stitch-stat-icon-box" aria-hidden="true">
            {icon}
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="stitch-stat-skeleton">
          <div className="stitch-skeleton" style={{ width: '76px', height: '38px' }} />
          <div className="stitch-skeleton" style={{ width: '100%', height: '14px', marginTop: '12px' }} />
        </div>
      ) : (
        <>
          <div className="stitch-stat-middle">
            <div className="stitch-stat-value tabular-num">{value}</div>
            {deltaText && (
              <span className={`stitch-stat-delta stitch-delta-${variant}`}>
                {deltaPrefixIcon}
                <span>{deltaText}</span>
              </span>
            )}
          </div>

          <div className="stitch-stat-footer">
            <span>{footerLeft || meta}</span>
            {footerRight && <strong className={`stitch-footer-strong stitch-strong-${variant}`}>{footerRight}</strong>}
          </div>
        </>
      )}
    </article>
  )
}
