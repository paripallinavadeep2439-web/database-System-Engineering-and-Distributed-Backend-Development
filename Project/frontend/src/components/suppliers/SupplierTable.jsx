import { Eye, Pencil, Trash2 } from "lucide-react";
import StatusBadge from "../common/StatusBadge";
import { formatINR } from "../../utils/formatters";

export default function SupplierTable({ items, onView, onEdit, onDelete }) {
  return (
    <div className="table-scroll">
      <table className="table">
        <thead>
          <tr>
            <th>Supplier</th>
            <th>Contact</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Medicines Supplied</th>
            <th>Outstanding</th>
            <th>Status</th>
            <th style={{ textAlign: "right" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((s) => (
            <tr key={s.id}>
              <td>
                <div className="cell-primary" onClick={() => onView?.(s)}>{s.name}</div>
                <div className="cell-sub">{s.id}</div>
              </td>
              <td className="text-muted">{s.contact}</td>
              <td className="text-muted">{s.email}</td>
              <td className="text-muted">{s.phone}</td>
              <td>{s.medicinesSupplied}</td>
              <td className="money">{s.outstanding ? formatINR(s.outstanding) : <span className="status-badge status-success">Cleared</span>}</td>
              <td><StatusBadge status={s.status} /></td>
              <td>
                <div className="row-actions" style={{ justifyContent: "flex-end" }}>
                  <button className="icon-btn accent" onClick={() => onView?.(s)} aria-label={`View ${s.name}`} title="View"><Eye size={16} /></button>
                  {onEdit && <button className="icon-btn" onClick={() => onEdit(s)} aria-label={`Edit ${s.name}`} title="Edit"><Pencil size={16} /></button>}
                  {onDelete && <button className="icon-btn danger" onClick={() => onDelete(s)} aria-label={`Delete ${s.name}`} title="Delete"><Trash2 size={16} /></button>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
