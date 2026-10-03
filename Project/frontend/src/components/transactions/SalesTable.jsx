import { useState } from "react";
import { Undo2 } from "lucide-react";
import StatusBadge from "../common/StatusBadge";
import Button from "../common/Button";
import { formatINR, formatDate, formatNumber } from "../../utils/formatters";

function ConfirmRefund({ sale, onConfirm, onCancel, busy, error }) {
  const [reason, setReason] = useState("");
  return (
    <div className="refund-confirm" data-testid="refund-confirm">
      <p className="text-sm muted" style={{ marginBottom: 8 }}>
        Refunding invoice <strong>{sale.saleNo}</strong> returns {formatNumber(sale.quantity)} unit(s) to the exact
        batch(es) that supplied it and marks the sale as refunded. This cannot be undone.
      </p>
      <div className="form-field">
        <label className="form-label" htmlFor={`refund-reason-${sale.id}`}>Reason</label>
        <input
          id={`refund-reason-${sale.id}`}
          className="form-input"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Optional note, e.g. wrong item dispatched"
          maxLength={240}
        />
      </div>
      {error && <div className="field-error" role="alert">{error}</div>}
      <div className="flex gap-8" style={{ marginTop: 10 }}>
        <Button size="sm" icon={Undo2} onClick={() => onConfirm(reason)} disabled={busy}>
          {busy ? "Refunding..." : "Confirm Refund"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
      </div>
    </div>
  );
}

export default function SalesTable({ items, onRefund, canRefund }) {
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const confirm = async (reason) => {
    if (!onRefund) return;
    setBusy(true);
    setError("");
    try {
      await onRefund(pending.id, reason);
      setPending(null);
    } catch (requestError) {
      setError(requestError.message || "Could not refund this sale.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="table-scroll">
      <table className="table">
        <thead>
          <tr>
            <th scope="col">Invoice No</th>
            <th scope="col">Medicine</th>
            <th scope="col">Batch</th>
            <th scope="col">Quantity</th>
            <th scope="col">Unit Price</th>
            <th scope="col">Total</th>
            <th scope="col">Customer</th>
            <th scope="col">Date</th>
            <th scope="col">Status</th>
            {canRefund && <th scope="col">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {items.map((s) => (
            <tr key={s.id} data-testid="sale-row">
              <td className="cell-primary">{s.saleNo}</td>
              <td>{s.medicine}</td>
              <td className="muted">{s.batch}</td>
              <td>{formatNumber(s.quantity)}</td>
              <td className="money">{formatINR(s.unitPrice)}</td>
              <td className="money" style={{ fontWeight: 600 }}>{formatINR(s.total)}</td>
              <td className="text-muted">{s.customer}</td>
              <td className="muted">{formatDate(s.date)}</td>
              <td><StatusBadge status={s.status} /></td>
              {canRefund && (
                <td>
                  {s.status === "Completed" ? (
                    <Button size="sm" variant="ghost" data-testid={`refund-${s.saleNo}`} onClick={() => { setPending(s); setError(""); }}>
                      Refund
                    </Button>
                  ) : (
                    <span className="muted text-sm">Refunded {formatDate(s.refundedAt)}</span>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {pending && (
        <div className="card" style={{ margin: 16 }}>
          <ConfirmRefund
            sale={pending}
            busy={busy}
            error={error}
            onConfirm={confirm}
            onCancel={() => { setPending(null); setError(""); }}
          />
        </div>
      )}
    </div>
  );
}
