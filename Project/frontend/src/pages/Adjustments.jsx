import { useEffect, useState } from "react";
import PageHeader from "../components/layout/PageHeader";
import Button from "../components/common/Button";
import { useToast } from "../contexts/ToastContext";
import { Plus, SlidersHorizontal } from "lucide-react";
import { REASONS } from "../utils/constants";
import { formatDate, todayISO } from "../utils/formatters";
import * as api from "../services/api";

const EMPTY_FORM = { medicineId: "", batchId: "", quantityDelta: "", reason: "", note: "" };

export default function Adjustments() {
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [medicines, setMedicines] = useState([]);
  const [batches, setBatches] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    setError("");
    return Promise.all([api.getAdjustments({ limit: 100 }), api.getMedicines({ limit: 100 })])
      .then(([adjustments, medicineList]) => {
        setRows(adjustments);
        setMedicines(medicineList);
      })
      .catch((requestError) => setError(requestError.message || "Could not load adjustments."));
  };

  useEffect(() => { load(); }, []);

  // Only unexpired batches of the selected medicine can be adjusted, because an
  // adjustment is a stock correction on sellable stock.
  useEffect(() => {
    if (!form.medicineId) {
      setBatches([]);
      return;
    }
    api.getBatches({ medicineId: form.medicineId, limit: 100 })
      .then(setBatches)
      .catch((requestError) => setError(requestError.message || "Could not load batches."));
  }, [form.medicineId]);

  const update = (field) => (event) => {
    const value = event.target.value;
    setForm((current) => ({ ...current, [field]: value, ...(field === "medicineId" ? { batchId: "" } : {}) }));
    setErrors((current) => ({ ...current, [field]: "" }));
  };

  const validate = () => {
    const next = {};
    if (!form.medicineId) next.medicineId = "Select a medicine";
    if (!form.batchId) next.batchId = "Select a batch";
    const delta = Number(form.quantityDelta);
    if (form.quantityDelta === "" || !Number.isInteger(delta)) next.quantityDelta = "Enter a whole number, positive or negative";
    else if (delta === 0) next.quantityDelta = "Adjustment cannot be zero";
    if (!form.reason) next.reason = "Select a reason";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await api.createAdjustment({
        medicineId: form.medicineId,
        batchId: form.batchId,
        quantityDelta: Number(form.quantityDelta),
        reason: form.reason,
        note: form.note,
      });
      toast.success("Adjustment recorded", "Stock and the adjustment ledger were updated together.");
      setForm(EMPTY_FORM);
      setShowForm(false);
      await load();
    } catch (requestError) {
      toast.error("Adjustment failed", requestError.message || "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Inventory Adjustments"
        subtitle="Record corrections such as damage, expiry write-offs or stock found during a physical count."
        actions={<Button icon={Plus} onClick={() => setShowForm((value) => !value)} disabled={rows === null}>New Adjustment</Button>}
      />

      {showForm && (
        <form className="card" onSubmit={submit} style={{ marginBottom: 20 }} noValidate>
          <div className="card-header">
            <div>
              <div className="card-title">New Adjustment</div>
              <div className="card-sub">A positive number adds stock, a negative number removes it. The batch quantity and the ledger entry are written in one transaction.</div>
            </div>
          </div>
          <div className="form-grid">
            <div className="form-field">
              <label className="form-label" htmlFor="adjust-medicine">Medicine <span aria-hidden="true">*</span></label>
              <select id="adjust-medicine" data-testid="adjust-medicine" className={`form-select${errors.medicineId ? " invalid" : ""}`} value={form.medicineId} onChange={update("medicineId")} required>
                <option value="">Select a medicine</option>
                {medicines.map((medicine) => <option key={medicine.id} value={medicine.id}>{medicine.name} · {medicine.stock} in stock</option>)}
              </select>
              {errors.medicineId && <span className="field-error" role="alert">{errors.medicineId}</span>}
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="adjust-batch">Batch <span aria-hidden="true">*</span></label>
              <select id="adjust-batch" data-testid="adjust-batch" className={`form-select${errors.batchId ? " invalid" : ""}`} value={form.batchId} onChange={update("batchId")} required disabled={!form.medicineId}>
                <option value="">{form.medicineId ? "Select a batch" : "Select a medicine first"}</option>
                {batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.batchNo} · {batch.quantity} units · exp {formatDate(batch.expiryDate)}</option>)}
              </select>
              {errors.batchId && <span className="field-error" role="alert">{errors.batchId}</span>}
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="adjust-delta">Quantity change <span aria-hidden="true">*</span></label>
              <input id="adjust-delta" data-testid="adjust-delta" className={`form-input${errors.quantityDelta ? " invalid" : ""}`} type="number" step="1" value={form.quantityDelta} onChange={update("quantityDelta")} placeholder="e.g. -12 or 30" required />
              <span className="form-hint">Use a minus sign to remove stock.</span>
              {errors.quantityDelta && <span className="field-error" role="alert">{errors.quantityDelta}</span>}
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="adjust-reason">Reason <span aria-hidden="true">*</span></label>
              <select id="adjust-reason" data-testid="adjust-reason" className={`form-select${errors.reason ? " invalid" : ""}`} value={form.reason} onChange={update("reason")} required>
                <option value="">Select a reason</option>
                {REASONS.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
              </select>
              {errors.reason && <span className="field-error" role="alert">{errors.reason}</span>}
            </div>
            <div className="form-field" style={{ gridColumn: "1 / -1" }}>
              <label className="form-label" htmlFor="adjust-note">Note</label>
              <textarea id="adjust-note" data-testid="adjust-note" className="form-input" rows="2" maxLength={500} value={form.note} onChange={update("note")} placeholder="Optional context, e.g. stock count reference" />
            </div>
          </div>
          <div className="flex gap-8" style={{ marginTop: 14 }}>
            <Button type="submit" data-testid="adjust-submit" icon={SlidersHorizontal} disabled={saving}>{saving ? "Recording..." : "Record Adjustment"}</Button>
            <Button type="button" variant="ghost" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setErrors({}); }}>Cancel</Button>
          </div>
        </form>
      )}

      {error && <div className="field-error" role="alert" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Adjustment History</div>
            <div className="card-sub">Every correction records the quantity before and after it, so the ledger can be reconciled against stock on hand.</div>
          </div>
        </div>
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Medicine</th>
                <th scope="col">Batch</th>
                <th scope="col">Change</th>
                <th scope="col">Before</th>
                <th scope="col">After</th>
                <th scope="col">Reason</th>
                <th scope="col">Recorded by</th>
                <th scope="col">Date</th>
              </tr>
            </thead>
            <tbody>
              {rows === null && <tr><td colSpan="8" className="muted">Loading adjustments...</td></tr>}
              {rows !== null && rows.length === 0 && <tr><td colSpan="8" className="muted">No adjustments recorded yet.</td></tr>}
              {rows !== null && rows.map((row) => (
                <tr key={row.id} data-testid="adjustment-row">
                  <td>{row.medicine}</td>
                  <td>{row.batch}</td>
                  <td className={row.quantityDelta > 0 ? "text-success" : "text-danger"}>{row.quantityDelta > 0 ? `+${row.quantityDelta}` : row.quantityDelta}</td>
                  <td>{row.quantityBefore}</td>
                  <td>{row.quantityAfter}</td>
                  <td>{row.reason}</td>
                  <td>{row.createdByName}</td>
                  <td>{formatDate(row.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
