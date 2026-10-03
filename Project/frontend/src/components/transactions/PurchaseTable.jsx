import StatusBadge from "../common/StatusBadge";
import { formatINR, formatDate, formatNumber } from "../../utils/formatters";

export default function PurchaseTable({ items }) {
  return (
    <div className="table-scroll">
      <table className="table">
        <thead>
          <tr>
            <th>Purchase No</th>
            <th>Supplier</th>
            <th>Medicine</th>
            <th>Batch</th>
            <th>Quantity</th>
            <th>Unit Cost</th>
            <th>Total</th>
            {/* Outstanding is what makes a partial payment visible; without the
                column the status badge hides how much money is still owed. */}
            <th>Paid</th>
            <th>Outstanding</th>
            <th>Date</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((p) => (
            <tr key={p.id}>
              <td className="cell-primary">{p.purchaseNo}</td>
              <td className="text-muted">{p.supplier}</td>
              <td>{p.medicine}</td>
              <td className="muted">{p.batch}</td>
              <td>{formatNumber(p.quantity)}</td>
              <td className="money">{formatINR(p.unitCost)}</td>
              <td className="money" style={{ fontWeight: 600 }}>{formatINR(p.total)}</td>
              <td className="money">{formatINR(p.paidAmount ?? (p.status === "Paid" ? p.total : 0))}</td>
              <td className="money">{formatINR(p.outstanding ?? Math.max(0, (p.total || 0) - (p.paidAmount ?? (p.status === "Paid" ? p.total : 0))))}</td>
              <td className="muted">{formatDate(p.date)}</td>
              <td><StatusBadge status={p.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
