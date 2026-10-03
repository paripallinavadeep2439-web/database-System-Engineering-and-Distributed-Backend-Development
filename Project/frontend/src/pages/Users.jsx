import { useEffect, useState } from "react";
import { UserPlus } from "lucide-react";
import PageHeader from "../components/layout/PageHeader";
import SearchBar from "../components/common/SearchBar";
import LoadingState from "../components/common/LoadingState";
import StatusBadge from "../components/common/StatusBadge";
import EmptyState from "../components/common/EmptyState";
import Modal from "../components/common/Modal";
import Button from "../components/common/Button";
import * as api from "../services/api";
import { useToast } from "../contexts/ToastContext";
import { formatDate } from "../utils/formatters";
import { ROLES } from "../utils/constants";

export default function Users() {
  const toast = useToast();
  const [items, setItems] = useState(null);
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getUsers().then(setItems).catch(() => setItems([]));
  }, []);

  if (!items) return <LoadingState rows={4} />;
  const filtered = items.filter((user) => `${user.name} ${user.email} ${user.role}`.toLowerCase().includes(query.toLowerCase()));

  const changeRole = async (user, role) => {
    try {
      const saved = await api.updateUser(user.id, { role });
      setItems((current) => current.map((item) => item.id === user.id ? saved : item));
      toast.success("Role updated", `${user.name}'s role is now ${role}.`);
    } catch (error) {
      toast.error("Error", error.message || "Could not update role.");
    }
  };

  const createUser = async (payload) => {
    setSaving(true);
    try {
      const saved = await api.createUser(payload);
      setItems((current) => [saved, ...current]);
      setShowCreate(false);
      toast.success("User created", `${saved.name} can now sign in.`);
    } catch (error) {
      toast.error("Error", error.message || "Could not create user.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title="Users" subtitle="Manage team members, roles and access within PharmaStock." actions={<Button icon={UserPlus} onClick={() => setShowCreate(true)}>Add User</Button>} />
      <div className="filter-bar"><SearchBar value={query} onChange={setQuery} placeholder="Search users..." /></div>
      {filtered.length === 0 ? <EmptyState title="No users found" subtitle="Try a different search." /> : <div className="table-wrap"><div className="table-scroll"><table className="table"><thead><tr><th>User</th><th>Email</th><th>Role</th><th>Phone</th><th>Joined</th><th>Status</th></tr></thead><tbody>{filtered.map((user) => <tr key={user.id}><td><div className="flex gap-12"><div className="avatar avatar-sm">{user.avatar}</div><div><div style={{ fontWeight: 600 }}>{user.name}</div><div className="cell-sub">{user.id}</div></div></div></td><td className="text-muted">{user.email}</td><td><select className="form-select" style={{ width: "auto", minWidth: 160, padding: "5px 28px 5px 10px" }} value={user.role} onChange={(event) => changeRole(user, event.target.value)} aria-label={`Role for ${user.name}`}>{ROLES.map((role) => <option key={role} value={role}>{role}</option>)}</select></td><td className="text-muted">{user.phone || "—"}</td><td className="muted">{formatDate(user.joined)}</td><td><StatusBadge status={user.status} /></td></tr>)}</tbody></table></div></div>}
      {showCreate && <CreateUserModal saving={saving} onClose={() => setShowCreate(false)} onSubmit={createUser} />}
    </div>
  );
}

function CreateUserModal({ saving, onClose, onSubmit }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", role: "Viewer" });
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const submit = (event) => { event.preventDefault(); onSubmit(form); };
  return <Modal open onClose={onClose} title="Add User" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={saving}>{saving ? "Creating..." : "Create User"}</Button></>}><form onSubmit={submit} className="form-grid"><div className="field-group"><label className="field-label" htmlFor="ur-name">Full Name</label><input id="ur-name" className="form-input" required value={form.name} onChange={set("name")} /></div><div className="field-group"><label className="field-label" htmlFor="ur-email">Email</label><input id="ur-email" className="form-input" type="email" required value={form.email} onChange={set("email")} /></div><div className="field-group"><label className="field-label" htmlFor="ur-pass">Temporary Password</label><input id="ur-pass" className="form-input" type="password" minLength={8} required value={form.password} onChange={set("password")} /></div><div className="field-group"><label className="field-label" htmlFor="ur-phone">Phone</label><input id="ur-phone" className="form-input" value={form.phone} onChange={set("phone")} /></div><div className="field-group"><label className="field-label" htmlFor="ur-role">Role</label><select id="ur-role" className="form-select" value={form.role} onChange={set("role")}>{ROLES.map((role) => <option key={role}>{role}</option>)}</select></div></form></Modal>;
}
