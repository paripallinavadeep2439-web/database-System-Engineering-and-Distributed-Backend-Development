import { useNavigate } from "react-router-dom";
import StatusBadge from "../common/StatusBadge";
import { formatDate, formatNumber, daysUntil } from "../../utils/formatters";

export default function BatchTable({ items }) {
  const navigate = useNavigate();

  // Derive status from expiry so it stays accurate.
  const rows = items.map((b) => {
    const d = daysUntil(b.expiryDate);
    let status = b.status;
    if (b.quantity <= 0) status = "Depleted";
    else if (d < 0) status = "Expired";
    else if (d <= 30) status = "Near Expiry";
    return { ...b, derived: status };
  });

  return (
    <div className="table-scroll">
      <table className="table">
        <thead>
          <tr>
            <th>Batch ID</th>
            <th>Medicine</th>
            <th>Supplier</th>
            <th>Mfg Date</th>
            <th>Expiry Date</th>
            <th>Quantity</th>
            <th>Days Left</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => {
            const d = daysUntil(b.expiryDate);
            return (
              <tr key={b.id}>
                <td className="cell-primary" onClick={() => navigate(`/batches?id=${b.id}`)}>{b.batchNo}</td>
                <td>
                  <div className="cell-primary" style={{ cursor: "pointer" }} onClick={() => navigate(`/medicines/${b.medicineId}`)}>{b.medicineName}</div>
                </td>
                <td className="text-muted">{b.supplierName}</td>
                <td className="muted">{formatDate(b.manufactureDate)}</td>
                <td className={d < 0 ? "muted" : ""}>{formatDate(b.expiryDate)}</td>
                <td style={{ fontWeight: 600 }}>{formatNumber(b.quantity)}</td>
                <td>
                  <span className={`status-badge ${d < 0 ? "status-danger" : d <= 30 ? "status-warning" : "status-success"}`}>
                    {d < 0 ? "Expired" : `${d} days`}
                  </span>
                </td>
                <td><StatusBadge status={b.derived} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
