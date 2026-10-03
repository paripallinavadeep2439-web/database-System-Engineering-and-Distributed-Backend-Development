import PageHeader from "../components/layout/PageHeader";
import Button from "../components/common/Button";
import { useSettings } from "../contexts/SettingsContext";
import { useToast } from "../contexts/ToastContext";
import { THEMES, CURRENCIES, DATE_FORMATS, ITEMS_PER_PAGE_OPTIONS } from "../utils/constants";

export default function Settings() {
  const { settings, update, toggleTheme } = useSettings();
  const toast = useToast();
  const toggleNotif = (key) => {
    update({ notifications: { ...settings.notifications, [key]: !settings.notifications[key] } });
    toast.success("Updated", "Notification preference saved.");
  };

  const save = (e) => {
    e.preventDefault();
    toast.success("Settings saved", "Your preferences have been stored on this device.");
  };

  return (
    <div>
      <PageHeader title="Settings" subtitle="Customize the appearance, notifications and preferences of PharmaStock." />

      <form className="card" style={{ marginBottom: 20 }} onSubmit={save}>
        <div className="card-header"><div><div className="card-title">Appearance</div></div></div>
        <div className="field-group" style={{ maxWidth: 320 }}>
          <label className="field-label" htmlFor="theme">Theme</label>
          <select id="theme" className="form-select" value={settings.theme} onChange={(e) => { update({ theme: e.target.value }); }}>
            {THEMES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <span className="form-hint">Current: {settings.theme}</span>
        </div>
        <Button variant="ghost" onClick={(e) => { e.preventDefault(); toggleTheme(); }}>Switch Theme</Button>
      </form>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header"><div><div className="card-title">Notifications</div><div className="card-sub">Choose which alerts you receive.</div></div></div>
        <div className="grid grid-2">
          {[
            { key: "lowStock", label: "Low stock alerts" },
            { key: "expiry", label: "Expiry alerts" },
            { key: "purchases", label: "Purchase updates" },
            { key: "sales", label: "Sales updates" },
          ].map((n) => (
            <label className="check-row" key={n.key} style={{ padding: "10px 12px", background: "var(--surface-alt)", borderRadius: 12 }}>
              <input
                type="checkbox"
                checked={settings.notifications[n.key]}
                onChange={() => toggleNotif(n.key)}
              />
              {n.label}
            </label>
          ))}
        </div>
      </div>

      <form className="card" style={{ marginBottom: 20 }} onSubmit={save}>
        <div className="card-header"><div><div className="card-title">Preferences</div></div></div>
        <div className="form-grid">
          <div className="field-group">
            <label className="field-label" htmlFor="currency">Currency</label>
            <select id="currency" className="form-select" value={settings.currency} onChange={(e) => update({ currency: e.target.value })}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="field-group">
            <label className="field-label" htmlFor="dateFmt">Date Format</label>
            <select id="dateFmt" className="form-select" value={settings.dateFormat} onChange={(e) => update({ dateFormat: e.target.value })}>
              {DATE_FORMATS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>
          <div className="field-group">
            <label className="field-label" htmlFor="perpage">Items per Page</label>
            <select id="perpage" className="form-select" value={settings.itemsPerPage} onChange={(e) => update({ itemsPerPage: Number(e.target.value) })}>
              {ITEMS_PER_PAGE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
        <Button type="submit">Save Preferences</Button>
      </form>

      {/* Stated as it actually behaves: these preferences are per-browser and
          per-device. They are not stored on the server, so they do not follow the
          user to another machine, and clearing site data resets them. */}
      <p className="muted text-sm">
        Preferences are stored in this browser only (localStorage). They are not saved to your user account, so they do
        not follow you to another device or browser, and clearing this site's data resets them to their defaults.
      </p>
    </div>
  );
}
