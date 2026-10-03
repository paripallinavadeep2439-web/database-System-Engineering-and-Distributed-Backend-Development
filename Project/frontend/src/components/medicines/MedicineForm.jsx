import { useEffect, useState } from "react";
import Modal from "../common/Modal";
import Button from "../common/Button";
import { required, positive, nonNegative, validate } from "../../utils/validators";
import { MEDICINE_CATEGORIES } from "../../utils/constants";

const BLANK = { name: "", generic: "", category: MEDICINE_CATEGORIES[0], manufacturer: "", dosage: "", unitPrice: "", reorderLevel: "" };

export default function MedicineForm({ open, onClose, onSubmit, initial }) {
  const [form, setForm] = useState(BLANK);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (open) {
      setForm(initial ? { ...BLANK, ...initial } : BLANK);
      setErrors({});
    }
  }, [open, initial]);

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = (event) => {
    event.preventDefault();
    const nextErrors = validate({ name: [required], generic: [required], manufacturer: [required], unitPrice: [positive], reorderLevel: [nonNegative] }, form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    onSubmit({ name: form.name, generic: form.generic, category: form.category, manufacturer: form.manufacturer, dosage: form.dosage, unitPrice: Number(form.unitPrice), reorderLevel: Number(form.reorderLevel) });
  };

  return (
    <Modal open={open} onClose={onClose} title={initial ? "Edit Medicine" : "Add Medicine"} size="lg" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={submit}>{initial ? "Save Changes" : "Add Medicine"}</Button></>}>
      <form onSubmit={submit} noValidate className="form-grid">
        <div className="field-group"><label className="field-label" htmlFor="mf-name">Medicine Name <span className="req">*</span></label><input id="mf-name" className={`form-input ${errors.name ? "error" : ""}`} value={form.name} onChange={set("name")} placeholder="Paracetamol 500mg" />{errors.name && <span className="field-error">{errors.name}</span>}</div>
        <div className="field-group"><label className="field-label" htmlFor="mf-generic">Generic Name <span className="req">*</span></label><input id="mf-generic" className={`form-input ${errors.generic ? "error" : ""}`} value={form.generic} onChange={set("generic")} placeholder="Acetaminophen" />{errors.generic && <span className="field-error">{errors.generic}</span>}</div>
        <div className="field-group"><label className="field-label" htmlFor="mf-category">Category</label><select id="mf-category" className="form-select" value={form.category} onChange={set("category")}>{MEDICINE_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></div>
        <div className="field-group"><label className="field-label" htmlFor="mf-manufacturer">Manufacturer <span className="req">*</span></label><input id="mf-manufacturer" className={`form-input ${errors.manufacturer ? "error" : ""}`} value={form.manufacturer} onChange={set("manufacturer")} placeholder="Sun Pharma" />{errors.manufacturer && <span className="field-error">{errors.manufacturer}</span>}</div>
        <div className="field-group"><label className="field-label" htmlFor="mf-dosage">Dosage</label><input id="mf-dosage" className="form-input" value={form.dosage} onChange={set("dosage")} placeholder="500 mg tab" /></div>
        <div className="field-group"><label className="field-label" htmlFor="med-price">Unit Price (₹)</label><input id="med-price" className={`form-input ${errors.unitPrice ? "error" : ""}`} type="number" step="0.01" min="0" value={form.unitPrice} onChange={set("unitPrice")} placeholder="0.00" />{errors.unitPrice && <span className="field-error">{errors.unitPrice}</span>}</div>
        <div className="field-group"><label className="field-label" htmlFor="med-reorder">Reorder Level</label><input id="med-reorder" className={`form-input ${errors.reorderLevel ? "error" : ""}`} type="number" min="0" step="1" value={form.reorderLevel} onChange={set("reorderLevel")} placeholder="200" />{errors.reorderLevel && <span className="field-error">{errors.reorderLevel}</span>}</div>
      </form>
    </Modal>
  );
}
