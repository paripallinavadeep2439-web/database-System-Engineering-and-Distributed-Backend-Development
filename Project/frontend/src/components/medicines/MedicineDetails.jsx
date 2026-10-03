import { Link } from "react-router-dom";
import { ArrowLeft, Pill } from "lucide-react";
import StatusBadge from "../common/StatusBadge";
import { formatINR, formatNumber, formatDate, daysUntil } from "../../utils/formatters";
import { getBatchesByMedicine } from "../../services/api";
import { useEffect, useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

function batchStatus(expiry, qty) {
  const d = daysUntil(expiry);
  if (d < 0) return "Expired";
  if (qty <= 0) return "Depleted";
  if (d <= 30) return "Near Expiry";
  return "Active";
}

export default function MedicineDetails({ medicine }) {
  const [batches, setBatches] = useState([]);

  useEffect(() => {
    let mounted = true;
    getBatchesByMedicine(medicine.id).then((b) => {
      if (mounted) setBatches(b.map((x) => ({ ...x, status: batchStatus(x.expiryDate, x.quantity) })));
    }).catch(() => {
      if (mounted) setBatches([]);
    });
    return () => { mounted = false; };
  }, [medicine.id]);

  const ratio = medicine.stock / (medicine.reorderLevel || 1);
  const stockStatus = medicine.stock === 0 ? "Out of Stock" : ratio < 0.5 ? "Critical" : ratio < 1 ? "Low Stock" : "Healthy";
  const needsReorder = medicine.stock < medicine.reorderLevel;

  return (
    <div>
      <Link to="/medicines" className="back-link"><ArrowLeft size={16} /> Back to Medicines</Link>

      <div className="detail-hero animate-in">
        <div className="detail-thumb"><Pill size={26} /></div>
        <div style={{ flex: 1 }}>
          <h1 className="ph-title" style={{ fontSize: 22, margin: 0 }}>{medicine.name}</h1>
          <p className="ph-sub" style={{ margin: 0 }}>{medicine.generic} · {medicine.dosage}</p>
        </div>
        <StatusBadge status={stockStatus} />
      </div>

      {/* Specs */}
      <div className="spec-grid" style={{ marginBottom: 20 }}>
        <div className="spec-item"><div className="si-label">Category</div><div className="si-value">{medicine.category}</div></div>
        <div className="spec-item"><div className="si-label">Manufacturer</div><div className="si-value">{medicine.manufacturer}</div></div>
        <div className="spec-item"><div className="si-label">Unit Price</div><div className="si-value">{formatINR(medicine.unitPrice)}</div></div>
        <div className="spec-item"><div className="si-label">Total Stock</div><div className="si-value">{formatNumber(medicine.stock)}</div></div>
        <div className="spec-item"><div className="si-label">Reorder Threshold</div><div className="si-value">{formatNumber(medicine.reorderLevel)}</div></div>
        <div className="spec-item">
          <div className="si-label">Reorder Recommendation</div>
          <div className="si-value">
            {needsReorder ? (
              <StatusBadge status="Critical" />
            ) : (
              <StatusBadge status="Healthy" />
            )}
          </div>
        </div>
      </div>

      {/* Analytics */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div>
            <div className="card-title">Current Stock Position</div>
            <div className="card-sub">Available units across active batches</div>
          </div>
          <StatusBadge status={needsReorder ? "Low Stock" : "Healthy"} dot={false} />
        </div>
        <div className="chart-box chart-height-sm">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={[{ month: "Current", stock: medicine.stock }]} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" stroke="var(--text-muted)" tickLine={false} axisLine={false} dy={8} />
              <YAxis stroke="var(--text-muted)" tickLine={false} axisLine={false} width={40} />
              <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12 }} />
              <Line type="monotone" dataKey="stock" name="Stock" stroke="#14b8a6" strokeWidth={3} dot={{ r: 3, fill: "#14b8a6" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        {needsReorder && (
          <div className="toast warning" style={{ marginTop: 16 }}>
            <span className="toast-warning-icon">⚠</span>
            <div>
              <div className="toast-title">Reorder recommended</div>
              <div className="toast-message">Current stock is below the reorder level. Suggested: raise a purchase order for {Math.max(medicine.reorderLevel * 2 - medicine.stock, medicine.reorderLevel)} units.</div>
            </div>
          </div>
        )}
      </div>

      {/* Batch history */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div>
            <div className="card-title">Batch History</div>
            <div className="card-sub">All lots for {medicine.name}</div>
          </div>
        </div>
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Batch No</th>
                <th>Mfg Date</th>
                <th>Expiry</th>
                <th>Quantity</th>
                <th>Supplier</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {batches.length === 0 ? (
                <tr><td colSpan={6} className="muted" style={{ padding: 24, textAlign: "center" }}>No batches recorded for this medicine.</td></tr>
              ) : (
                batches.map((b) => (
                  <tr key={b.id}>
                    <td className="cell-primary">{b.batchNo}</td>
                    <td className="muted">{formatDate(b.manufactureDate)}</td>
                    <td>{formatDate(b.expiryDate)}</td>
                    <td>{formatNumber(b.quantity)}</td>
                    <td className="text-muted">{b.supplierName}</td>
                    <td><StatusBadge status={b.status} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
