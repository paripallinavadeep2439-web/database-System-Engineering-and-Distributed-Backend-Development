import { Eye, Pencil, Trash2 } from "lucide-react";
import StatusBadge from "../common/StatusBadge";
import { formatINR, formatNumber } from "../../utils/formatters";

function stockStatus(stock, reorder) {
  if (stock === 0) return "Out of Stock";
  if (stock < reorder * 0.5) return "Critical";
  if (stock < reorder) return "Low Stock";
  return "Healthy";
}

export default function MedicineTable({ items, onView, onEdit, onDelete, onSort, sortKey, sortDir }) {
  const th = (key, label) => (
    <th className={sortKey === key ? `sortable sort-${sortDir}` : "sortable"} onClick={() => onSort?.(key)}>
      {label}
    </th>
  );

  return (
    <div className="table-scroll">
      <table className="table">
        <thead>
          <tr>
            {th("name", "Medicine")}
            {th("category", "Category")}
            {th("manufacturer", "Manufacturer")}
            {th("stock", "Stock")}
            {th("reorderLevel", "Reorder")}
            {th("unitPrice", "Unit Price")}
            <th>Status</th>
            <th style={{ textAlign: "right" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((m) => (
            <tr key={m.id}>
              <td>
                <div className="cell-primary" onClick={() => onView?.(m)}>{m.name}</div>
                <div className="cell-sub">{m.generic} · {m.dosage}</div>
              </td>
              <td className="text-muted">{m.category}</td>
              <td className="text-muted">{m.manufacturer}</td>
              <td>
                <span style={{ fontWeight: 600 }}>{formatNumber(m.stock)}</span>{" "}
                <span className="muted text-sm">({m.reorderLevel})</span>
              </td>
              <td className="muted">{formatNumber(m.reorderLevel)}</td>
              <td className="money">{formatINR(m.unitPrice)}</td>
              <td><StatusBadge status={stockStatus(m.stock, m.reorderLevel)} /></td>
              <td>
                <div className="row-actions" style={{ justifyContent: "flex-end" }}>
                  <button className="icon-btn accent" onClick={() => onView?.(m)} aria-label={`View ${m.name}`} title="View"><Eye size={16} /></button>
                  {onEdit && <button className="icon-btn" onClick={() => onEdit(m)} aria-label={`Edit ${m.name}`} title="Edit"><Pencil size={16} /></button>}
                  {onDelete && <button className="icon-btn danger" onClick={() => onDelete(m)} aria-label={`Delete ${m.name}`} title="Delete"><Trash2 size={16} /></button>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
