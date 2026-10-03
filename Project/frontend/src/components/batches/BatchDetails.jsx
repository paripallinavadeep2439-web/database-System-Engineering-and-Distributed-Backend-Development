import Modal from "../common/Modal";
import StatusBadge from "../common/StatusBadge";
import { formatDate, formatNumber, daysUntil, formatINR } from "../../utils/formatters";

export default function BatchDetails({ batch, onClose }) {
  if (!batch) return null;
  const d = daysUntil(batch.expiryDate);
  const status = batch.quantity <= 0 ? "Depleted" : d < 0 ? "Expired" : d <= 30 ? "Near Expiry" : "Active";

  return (
    <Modal open onClose={onClose} title={`Batch ${batch.batchNo}`}>
      <div className="summary-strip" style={{ marginBottom: 16 }}>
        <div className="summary-item">
          <span className="si-label">Status</span>
          <span className="si-value"><StatusBadge status={status} /></span>
        </div>
        <div className="summary-item">
          <span className="si-label">Days to expiry</span>
          <span className="si-value" style={{ color: d < 0 ? "var(--danger)" : d <= 30 ? "var(--warning)" : "var(--success)" }}>
            {d < 0 ? `Expired ${Math.abs(d)}d ago` : d}
          </span>
        </div>
      </div>

      <div className="spec-grid">
        <div className="spec-item"><div className="si-label">Medicine</div><div className="si-value">{batch.medicineName}</div></div>
        <div className="spec-item"><div className="si-label">Supplier</div><div className="si-value">{batch.supplierName}</div></div>
        <div className="spec-item"><div className="si-label">Manufacture Date</div><div className="si-value">{formatDate(batch.manufactureDate)}</div></div>
        <div className="spec-item"><div className="si-label">Expiry Date</div><div className="si-value">{formatDate(batch.expiryDate)}</div></div>
        <div className="spec-item"><div className="si-label">Quantity</div><div className="si-value">{formatNumber(batch.quantity)}</div></div>
        <div className="spec-item"><div className="si-label">Cost / Unit</div><div className="si-value">{formatINR(batch.costPerUnit)}</div></div>
      </div>
    </Modal>
  );
}
