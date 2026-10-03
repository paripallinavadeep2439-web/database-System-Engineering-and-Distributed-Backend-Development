import { useEffect, useState } from "react";
import Modal from "../common/Modal";
import Button from "../common/Button";
import { required, validate } from "../../utils/validators";
import * as api from "../../services/api";

// A batch registers a container only. Quantity and cost are deliberately absent
// from this form because the API rejects them here: stock can only enter through
// a purchase, which is what keeps the ledger and COGS trustworthy.
const BLANK = { medicineId: "", batchNo: "", manufactureDate: "", expiryDate: "", supplierId: "" };

export default function BatchForm({ open, onClose, onSubmit, existing = [], busy = false }) {
  const [form, setForm] = useState(BLANK);
  const [errors, setErrors] = useState({});
  const [medicines, setMedicines] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  useEffect(() => {
    if (!open) return;
    setForm(BLANK);
    setErrors({});
    Promise.all([api.getMedicines(), api.getSuppliers()]).then(([medicineRows, supplierRows]) => {
      setMedicines(medicineRows);
      setSuppliers(supplierRows.filter((supplier) => supplier.status === "Active"));
    }).catch(() => {
      setMedicines([]);
      setSuppliers([]);
    });
  }, [open]);

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = (event) => {
    event.preventDefault();
    const nextErrors = validate({ medicineId: [required], batchNo: [required], manufactureDate: [required], expiryDate: [required], supplierId: [required] }, form);
    if (form.manufactureDate && form.expiryDate && new Date(form.expiryDate) <= new Date(form.manufactureDate)) nextErrors.expiryDate = "Expiry date must be after the manufacturing date";
    if (existing.some((batch) => batch.batchNo.toLowerCase() === form.batchNo.trim().toLowerCase())) nextErrors.batchNo = "This batch number already exists";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    onSubmit({ medicineId: form.medicineId, batchNo: form.batchNo.trim(), manufactureDate: form.manufactureDate, expiryDate: form.expiryDate, supplierId: form.supplierId });
  };

  return (
    <Modal open={open} onClose={onClose} title="Add Batch" size="lg" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={busy}>{busy ? "Saving..." : "Add Batch"}</Button></>}>
      <form onSubmit={submit} noValidate className="form-grid">
        <div className="field-group"><label className="field-label" htmlFor="batchMedicine">Medicine <span className="req">*</span></label><select id="batchMedicine" className={`form-select ${errors.medicineId ? "error" : ""}`} value={form.medicineId} onChange={set("medicineId")}><option value="">Select medicine</option>{medicines.map((medicine) => <option key={medicine.id} value={medicine.id}>{medicine.name}</option>)}</select>{errors.medicineId && <span className="field-error">{errors.medicineId}</span>}</div>
        <div className="field-group"><label className="field-label" htmlFor="batchNo">Batch Number <span className="req">*</span></label><input id="batchNo" className={`form-input ${errors.batchNo ? "error" : ""}`} value={form.batchNo} onChange={set("batchNo")} placeholder="PCM-24-A001" />{errors.batchNo && <span className="field-error">{errors.batchNo}</span>}</div>
        <div className="field-group"><label className="field-label" htmlFor="batchMfg">Manufacturing Date <span className="req">*</span></label><input id="batchMfg" className={`form-input ${errors.manufactureDate ? "error" : ""}`} type="date" value={form.manufactureDate} onChange={set("manufactureDate")} />{errors.manufactureDate && <span className="field-error">{errors.manufactureDate}</span>}</div>
        <div className="field-group"><label className="field-label" htmlFor="batchExpiry">Expiry Date <span className="req">*</span></label><input id="batchExpiry" className={`form-input ${errors.expiryDate ? "error" : ""}`} type="date" value={form.expiryDate} onChange={set("expiryDate")} />{errors.expiryDate && <span className="field-error">{errors.expiryDate}</span>}</div>
        <div className="field-group" style={{ gridColumn: "1 / -1" }}><div className="card" style={{ background: "var(--surface-alt)" }}><span className="form-hint">The new batch is created empty (0 units, 0 cost). Record a purchase into it to add stock and set its weighted-average cost.</span></div></div>
        <div className="field-group"><label className="field-label" htmlFor="batchSupplier">Supplier <span className="req">*</span></label><select id="batchSupplier" className={`form-select ${errors.supplierId ? "error" : ""}`} value={form.supplierId} onChange={set("supplierId")}><option value="">Select supplier</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select>{errors.supplierId && <span className="field-error">{errors.supplierId}</span>}</div>
      </form>
    </Modal>
  );
}
