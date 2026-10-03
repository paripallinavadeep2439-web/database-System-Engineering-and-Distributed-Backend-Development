import { useEffect, useState } from "react";
import Modal from "../common/Modal";
import Button from "../common/Button";
import { required, email, phone, validate } from "../../utils/validators";

const BLANK = { name: "", contact: "", email: "", phone: "", status: "Active" };

export default function SupplierForm({ open, onClose, onSubmit, initial }) {
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
    const nextErrors = validate({ name: [required], contact: [required], email: [email], phone: [phone] }, form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    onSubmit({ name: form.name, contact: form.contact, email: form.email, phone: form.phone, status: form.status });
  };

  return (
    <Modal open={open} onClose={onClose} title={initial ? "Edit Supplier" : "Add Supplier"} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={submit}>{initial ? "Save Changes" : "Add Supplier"}</Button></>}>
      <form onSubmit={submit} noValidate className="form-grid">
        <div className="field-group"><label className="field-label" htmlFor="sf-name">Supplier Name <span className="req">*</span></label><input id="sf-name" className={`form-input ${errors.name ? "error" : ""}`} value={form.name} onChange={set("name")} placeholder="MediCore Distributors" />{errors.name && <span className="field-error">{errors.name}</span>}</div>
        <div className="field-group"><label className="field-label" htmlFor="sf-contactperson">Contact Person <span className="req">*</span></label><input id="sf-contactperson" className={`form-input ${errors.contact ? "error" : ""}`} value={form.contact} onChange={set("contact")} placeholder="Rahul Sharma" />{errors.contact && <span className="field-error">{errors.contact}</span>}</div>
        <div className="field-group"><label className="field-label" htmlFor="sf-email">Email</label><input id="sf-email" className={`form-input ${errors.email ? "error" : ""}`} type="email" value={form.email} onChange={set("email")} placeholder="sales@example.in" />{errors.email && <span className="field-error">{errors.email}</span>}</div>
        <div className="field-group"><label className="field-label" htmlFor="sf-phone">Phone</label><input id="sf-phone" className={`form-input ${errors.phone ? "error" : ""}`} value={form.phone} onChange={set("phone")} placeholder="+91 98xxx xxxxx" />{errors.phone && <span className="field-error">{errors.phone}</span>}</div>
        <div className="field-group"><label className="field-label" htmlFor="sf-status">Status</label><select id="sf-status" className="form-select" value={form.status} onChange={set("status")}><option value="Active">Active</option><option value="On Hold">On Hold</option><option value="Inactive">Inactive</option></select></div>
      </form>
    </Modal>
  );
}
