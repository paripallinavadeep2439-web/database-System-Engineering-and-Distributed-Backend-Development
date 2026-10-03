import { useEffect, useMemo, useState } from "react";
import Modal from "../common/Modal";
import Button from "../common/Button";
import { required, positive, validate } from "../../utils/validators";
import { PAYMENT_STATUS } from "../../utils/constants";
import * as api from "../../services/api";

function today() { return new Date().toISOString().slice(0, 10); }
function blankForm(kind, initial = {}) {
  return { medicineId: initial.medicineId || initial.medicine || "", supplierId: initial.supplierId || initial.supplier || "", batchId: initial.batchId || "", quantity: initial.suggested || initial.quantity || "", unitCost: initial.unitCost || initial.unitPrice || "", customer: initial.customer || "", status: kind === "purchase" ? "Paid" : "Completed", paidAmount: "", date: today() };
}

export default function TransactionForm({ open, onClose, onSubmit, kind, initial }) {
  const [form, setForm] = useState(() => blankForm(kind, initial));
  const [errors, setErrors] = useState({});
  const [medicines, setMedicines] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [batches, setBatches] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const isPurchase = kind === "purchase";

  useEffect(() => {
    if (!open) return;
    setForm(blankForm(kind, initial));
    setErrors({});
    Promise.all([api.getMedicines({ limit: 100 }), api.getSuppliers({ limit: 100 }), api.getBatches({ limit: 100 })]).then(([medicineRows, supplierRows, batchRows]) => {
      setMedicines(medicineRows);
      setSuppliers(supplierRows.filter((supplier) => supplier.status === "Active"));
      // A purchase adds stock to a batch, so empty batches are valid targets here.
      // Only expired batches are excluded, because receiving into one would create
      // stock that is unsellable the moment it arrives. Sales still narrow this
      // list further to batches that actually hold units.
      setBatches(batchRows.filter((batch) => batch.expiryDate >= today() && batch.status !== "Expired"));
    }).catch(() => {
      setMedicines([]);
      setSuppliers([]);
      setBatches([]);
    });
  }, [open, kind, initial]);

  const selectedMed = useMemo(() => medicines.find((medicine) => medicine.id === form.medicineId), [medicines, form.medicineId]);
  // Every non-expired batch of this medicine is a valid purchase target, including
  // empty ones, because receiving stock is what fills a batch up.
  const availableBatches = useMemo(() => batches.filter((batch) => batch.medicineId === form.medicineId), [batches, form.medicineId]);
  const selectedBatch = availableBatches.find((batch) => batch.id === form.batchId);
  const effectivePrice = form.unitCost || selectedBatch?.costPerUnit || selectedMed?.unitPrice || 0;
  const total = (Number(form.quantity) || 0) * (Number(effectivePrice) || 0);
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  // Receiving into a different batch changes the batch's cost basis, so the unit
  // cost is re-suggested from that batch instead of being left stale.
  const changeBatch = (event) => {
    const batchId = event.target.value;
    const batch = batches.find((item) => item.id === batchId);
    const fallback = medicines.find((medicine) => medicine.id === form.medicineId)?.unitPrice;
    setForm((current) => ({ ...current, batchId, unitCost: batch?.costPerUnit ?? batch?.unitCost ?? fallback ?? "" }));
  };

  const changeMedicine = (event) => {
    const medicineId = event.target.value;
    // Prefer a batch that already holds stock, so the suggested unit cost is a
    // real cost rather than a zero; fall back to the first usable batch.
    const candidates = batches.filter((batch) => batch.medicineId === medicineId && batch.expiryDate >= today());
    const nextBatch = candidates.find((batch) => batch.quantity > 0) || candidates[0];
    const nextMedicine = medicines.find((medicine) => medicine.id === medicineId);
    setForm((current) => ({ ...current, medicineId, batchId: isPurchase ? nextBatch?.id || "" : "", unitCost: isPurchase ? nextBatch?.costPerUnit ?? nextMedicine?.unitPrice ?? "" : current.unitCost }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const nextErrors = validate({ medicineId: [required], quantity: [positive], ...(isPurchase ? { unitCost: [positive], supplierId: [required], batchId: [required] } : { customer: [required] }) }, form);
    // "Partially Paid" is only meaningful with an amount strictly between zero and
    // the total, so the field is validated here as well as by the server.
    if (isPurchase && form.status === "Partially Paid") {
      const paid = Number(form.paidAmount);
      if (!Number.isFinite(paid) || paid <= 0 || paid >= total) {
        nextErrors.paidAmount = `Enter an amount above 0 and below the total of ₹${total.toFixed(2)}.`;
      }
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSubmitting(true);
    try {
      await onSubmit({ medicineId: form.medicineId, quantity: Number(form.quantity), ...(isPurchase ? { supplierId: form.supplierId, batchId: form.batchId, unitCost: Number(form.unitCost), status: form.status, ...(form.status === "Partially Paid" ? { paidAmount: Number(form.paidAmount) } : {}), date: form.date } : { unitPrice: Number(effectivePrice), customer: form.customer, date: form.date }) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={isPurchase ? "Record Purchase" : "Record Sale"} size="lg" footer={<><Button data-testid="transaction-cancel" variant="ghost" onClick={onClose}>Cancel</Button><Button data-testid="transaction-submit" onClick={submit} disabled={submitting}>{submitting ? "Saving..." : isPurchase ? "Record Purchase" : "Record Sale"}</Button></>}>
      <form onSubmit={submit} noValidate className="form-grid">
        <div className="field-group"><label className="field-label" htmlFor="transactionMedicine">Medicine <span className="req">*</span></label><select id="transactionMedicine" data-testid="transaction-medicine" className={`form-select ${errors.medicineId ? "error" : ""}`} value={form.medicineId} onChange={changeMedicine}><option value="">Select medicine</option>{medicines.map((medicine) => <option key={medicine.id} value={medicine.id}>{medicine.name}</option>)}</select>{errors.medicineId && <span className="field-error">{errors.medicineId}</span>}</div>
        {isPurchase ? <>
          <div className="field-group"><label className="field-label" htmlFor="purchaseBatch">Batch <span className="req">*</span></label><select id="purchaseBatch" data-testid="transaction-batch" className={`form-select ${errors.batchId ? "error" : ""}`} value={form.batchId} onChange={changeBatch}><option value="">Select batch to receive into</option>{availableBatches.map((batch) => <option key={batch.id} value={batch.id}>{batch.batchNo} · {batch.quantity} units · exp {batch.expiryDate}</option>)}</select>{errors.batchId && <span className="field-error">{errors.batchId}</span>}<span className="form-hint">Stock is added to the batch you choose, so an empty batch is a valid target.</span></div>
          <div className="field-group"><label className="field-label" htmlFor="purchaseSupplier">Supplier <span className="req">*</span></label><select data-testid="transaction-supplier" className={`form-select ${errors.supplierId ? "error" : ""}`} value={form.supplierId} onChange={set("supplierId")}><option value="">Select supplier</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select>{errors.supplierId && <span className="field-error">{errors.supplierId}</span>}</div>
        </> : <div className="field-group"><label className="field-label" htmlFor="transactionCustomer">Customer / Reference <span className="req">*</span></label><input id="transactionCustomer" data-testid="transaction-customer" className={`form-input ${errors.customer ? "error" : ""}`} value={form.customer} onChange={set("customer")} placeholder="City Meds" />{errors.customer && <span className="field-error">{errors.customer}</span>}</div>}
        <div className="field-group"><label className="field-label" htmlFor="transactionQuantity">Quantity <span className="req">*</span></label><input id="transactionQuantity" data-testid="transaction-quantity" className={`form-input ${errors.quantity ? "error" : ""}`} type="number" min="1" step="1" value={form.quantity} onChange={set("quantity")} placeholder="0" />{errors.quantity && <span className="field-error">{errors.quantity}</span>}</div>
        <div className="field-group"><label className="field-label" htmlFor="transactionUnitPrice">Unit {isPurchase ? "Cost" : "Price"} (₹)</label><input id="transactionUnitPrice" data-testid="transaction-unit-price" className={`form-input ${errors.unitCost || errors.unitPrice ? "error" : ""}`} type="number" min="0.01" step="0.01" value={form.unitCost} onChange={set("unitCost")} placeholder={selectedMed?.unitPrice || "0.00"} />{(errors.unitCost || errors.unitPrice) && <span className="field-error">{errors.unitCost || errors.unitPrice}</span>}{!isPurchase && selectedMed && <span className="form-hint">Default price: ₹{selectedMed.unitPrice}</span>}{isPurchase && selectedBatch && <span className="form-hint">Cost of the selected batch: ₹{selectedBatch.costPerUnit} per unit</span>}</div>
        {isPurchase && <div className="field-group"><label className="field-label" htmlFor="purchaseDate">Date</label><input id="purchaseDate" className="form-input" type="date" value={form.date} onChange={set("date")} /></div>}
        {isPurchase ? <><div className="field-group"><label className="field-label" htmlFor="paymentStatus">Payment Status</label><select id="paymentStatus" className="form-select" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value, paidAmount: event.target.value === "Partially Paid" ? current.paidAmount : "" }))}>{PAYMENT_STATUS.map((status) => <option key={status}>{status}</option>)}</select></div>{form.status === "Partially Paid" && <div className="field-group"><label className="field-label" htmlFor="paidAmount">Amount Paid (₹) <span className="req">*</span></label><input id="paidAmount" data-testid="transaction-paid-amount" className={`form-input ${errors.paidAmount ? "error" : ""}`} type="number" min="0.01" step="0.01" value={form.paidAmount} onChange={set("paidAmount")} placeholder={total.toFixed(2)} />{errors.paidAmount && <span className="field-error">{errors.paidAmount}</span>}<span className="form-hint">Must be above ₹0 and below the ₹{total.toFixed(2)} total; the remainder is recorded as outstanding.</span></div>}</> : <div className="field-group"><label className="field-label" htmlFor="saleDate">Date</label><input id="saleDate" className="form-input" type="date" value={form.date} onChange={set("date")} /></div>}
        <div className="field-group" style={{ gridColumn: "1 / -1" }}><div className="card" style={{ background: "var(--surface-alt)" }}><div className="flex-between"><span className="muted">Total Amount</span><span className="bold" style={{ fontSize: 20, fontFamily: "var(--font-display)" }}>₹{total.toFixed(2)}</span></div>{!isPurchase && <span className="form-hint">Stock is allocated using FEFO; earliest-expiry batches are consumed first.</span>}</div></div>
      </form>
    </Modal>
  );
}
