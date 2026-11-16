export default function ClusterBadge({ count = 1 }) {
  return (
    <div className="ag-cluster-pin" aria-label={}>
      <span>{count}</span>
    </div>
  );
}
