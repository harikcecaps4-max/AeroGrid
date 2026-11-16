export default function EmptyState({ title = 'No records found', description = 'Try adjusting sector filters.', action }) {
  return (
    <div className="empty-detail" role="status">
      <div className="empty-detail-title">{title}</div>
      <div className="empty-detail-desc">{description}</div>
      {action}
    </div>
  );
}
