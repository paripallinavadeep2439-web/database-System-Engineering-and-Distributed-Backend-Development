import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import PageHeader from "../components/layout/PageHeader";
import Button from "../components/common/Button";
import StatusBadge from "../components/common/StatusBadge";
import { formatDate } from "../utils/formatters";
import * as api from "../services/api";

export default function Profile() {
  const { user, updateCurrentUser } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ name: "", phone: "" });
  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "" });
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (user) setForm({ name: user.name || "", phone: user.phone || "" });
  }, [user]);

  if (!user) return null;
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const setPassword = (key) => (event) => setPasswords((current) => ({ ...current, [key]: event.target.value }));
  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await updateCurrentUser(form);
      toast.success("Profile saved", "Your profile details were updated.");
    } catch (error) {
      toast.error("Error", error.message || "Could not save profile.");
    } finally {
      setSaving(false);
    }
  };
  const changePassword = async (event) => {
    event.preventDefault();
    if (passwords.newPassword.length < 8) {
      toast.error("Error", "New password must be at least 8 characters.");
      return;
    }
    setChangingPassword(true);
    try {
      await api.changePassword(passwords);
      setPasswords({ currentPassword: "", newPassword: "" });
      toast.success("Password changed", "Your password was updated securely.");
    } catch (error) {
      toast.error("Error", error.message || "Could not change password.");
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div>
      <PageHeader title="Profile" subtitle="View and update your personal information and preferences." />
      <div className="detail-hero"><div className="avatar" style={{ width: 64, height: 64, fontSize: 22 }}>{user.avatar}</div><div style={{ flex: 1 }}><h1 className="ph-title" style={{ fontSize: 20, margin: 0 }}>{user.name}</h1><p className="ph-sub" style={{ margin: "2px 0 0" }}>{user.email}</p></div><StatusBadge status={user.status || "Active"} /></div>
      <div className="spec-grid" style={{ marginBottom: 24 }}><div className="spec-item"><div className="si-label">Role</div><div className="si-value">{user.role}</div></div><div className="spec-item"><div className="si-label">Phone</div><div className="si-value">{user.phone || "—"}</div></div><div className="spec-item"><div className="si-label">Joined</div><div className="si-value">{formatDate(user.joined)}</div></div><div className="spec-item"><div className="si-label">User ID</div><div className="si-value">{user.id}</div></div></div>
      <div className="grid grid-2">
        <form className="card" onSubmit={save}><div className="card-header"><div><div className="card-title">Edit Details</div><div className="card-sub">Update your profile information.</div></div></div><div className="form-grid"><div className="field-group"><label className="field-label" htmlFor="pf-name">Full Name</label><input id="pf-name" className="form-input" value={form.name} onChange={set("name")} required /></div><div className="field-group"><label className="field-label" htmlFor="pf-email">Email</label><input id="pf-email" className="form-input" value={user.email} readOnly /></div><div className="field-group"><label className="field-label" htmlFor="pf-phone">Phone</label><input id="pf-phone" className="form-input" value={form.phone} onChange={set("phone")} /></div><div className="field-group"><label className="field-label" htmlFor="pf-role">Role (read-only)</label><input id="pf-role" className="form-input" value={user.role} readOnly /></div></div><Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button></form>
        <form className="card" onSubmit={changePassword}><div className="card-header"><div><div className="card-title">Change Password</div><div className="card-sub">Use a unique password of at least 8 characters.</div></div></div><div className="form-grid"><div className="field-group"><label className="field-label" htmlFor="pf-curpass">Current Password</label><input id="pf-curpass" className="form-input" type="password" autoComplete="current-password" value={passwords.currentPassword} onChange={setPassword("currentPassword")} required /></div><div className="field-group"><label className="field-label" htmlFor="pf-newpass">New Password</label><input id="pf-newpass" className="form-input" type="password" autoComplete="new-password" minLength={8} value={passwords.newPassword} onChange={setPassword("newPassword")} required /></div></div><Button type="submit" disabled={changingPassword}>{changingPassword ? "Changing..." : "Change Password"}</Button></form>
      </div>
    </div>
  );
}
