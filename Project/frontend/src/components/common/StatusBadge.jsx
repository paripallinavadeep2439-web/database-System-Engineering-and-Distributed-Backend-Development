const STATUS_MAP = {
  active: "status-success",
  healthy: "status-success",
  paid: "status-success",
  completed: "status-success",
  "in stock": "status-success",
  low: "status-warning",
  "low stock": "status-warning",
  warning: "status-warning",
  pending: "status-warning",
  "partially paid": "status-warning",
  "near expiry": "status-warning",
  critical: "status-danger",
  danger: "status-danger",
  expired: "status-danger",
  refunded: "status-danger",
  depleted: "status-muted",
  "on hold": "status-info",
  inactive: "status-muted",
};

const DEFAULT = "status-info";

export default function StatusBadge({ status, dot = true }) {
  const key = String(status || "").toLowerCase();
  const cls = STATUS_MAP[key] || DEFAULT;
  return (
    <span className={`status-badge ${cls}`}>
      {dot && <span className="dot" aria-hidden="true" />}
      {status}
    </span>
  );
}
