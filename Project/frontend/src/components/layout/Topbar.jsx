import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Menu,
  Bell,
  Search,
  ChevronRight,
  LogOut,
  UserCircle,
  Settings,
  Pill,
  Truck,
  Layers,
  FileText,
  Check,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { useDebounce } from "../../hooks";
import * as api from "../../services/api";

function useClickOutside(ref, handler) {
  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) handler();
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [ref, handler]);
}

// The alert feed is shared, and acknowledging one is a state change. The API
// restricts it to inventory roles, so the button is offered to exactly the same
// roles. This mirrors the server rule for usability; the server is the boundary.
const ACKNOWLEDGE_ROLES = ["Admin", "Inventory Manager", "Pharmacist"];

const NOTIF_META = {
  low: { label: "Low stock", tone: "status-warning" },
  expiry: { label: "Near expiry", tone: "status-warning" },
  expired: { label: "Expired", tone: "status-danger" },
  system: { label: "System", tone: "status-info" },
  sale: { label: "Sale", tone: "status-success" },
  purchase: { label: "Purchase", tone: "status-success" },
};

const TITLES = {
  "/dashboard": "Dashboard",
  "/medicines": "Medicines",
  "/batches": "Batches",
  "/low-stock": "Low Stock",
  "/expiry": "Expiry",
  "/suppliers": "Suppliers",
  "/purchases": "Purchases",
  "/sales": "Sales",
  "/adjustments": "Inventory Adjustments",
  "/analytics": "Analytics",
  "/reports": "Reports",
  "/users": "Users",
  "/audit-log": "Audit Log",
  "/settings": "Settings",
  "/profile": "Profile",
};

export default function Topbar({ onToggleSidebar }) {
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [notifs, setNotifs] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchResults, setSearchResults] = useState(null);
  const debounced = useDebounce(query, 250);

  const notifRef = useRef(null);
  const userRef = useRef(null);
  const searchRef = useRef(null);
  useClickOutside(notifRef, () => setNotifOpen(false));
  useClickOutside(userRef, () => setUserMenu(false));
  useClickOutside(searchRef, () => setSearchOpen(false));

  const current = TITLES[location.pathname] || "PharmaStock";

  // One loader for the badge, the panel, and the post-acknowledgement refresh, so
  // the unread total and the visible rows can never disagree.
  const loadNotifications = useCallback(
    () =>
      api.getNotificationsPage({ limit: 10 }).then(({ rows, meta }) => {
        setNotifs(rows);
        setUnreadCount(Number(meta.unread || 0));
      }),
    []
  );

  useEffect(() => {
    let mounted = true;
    // The badge is driven by the server's unread total, not by how many rows
    // happen to fit in the panel, so it stays honest as alerts grow. It reloads
    // on every navigation as well as on first mount, because a purchase, sale,
    // refund or adjustment performed on the previous screen changes the count.
    loadNotifications().catch(() => {
      if (mounted) {
        setNotifs([]);
        setUnreadCount(0);
      }
    });
    return () => { mounted = false; };
  }, [location.pathname, loadNotifications]);

  useEffect(() => {
    const q = debounced.trim();
    if (!q) {
      setSearchResults(null);
      return undefined;
    }
    let mounted = true;
    api.search(q).then((results) => {
      if (mounted) setSearchResults(results);
    }).catch(() => {
      if (mounted) setSearchResults({ medicines: [], suppliers: [], batches: [], transactions: [] });
    });
    return () => { mounted = false; };
  }, [debounced]);

  const hasResults = searchResults && (searchResults.medicines.length || searchResults.suppliers.length || searchResults.batches.length || searchResults.transactions.length);

  // Each search result navigates to the screen that actually owns it. Falling
  // back to a single page for every kind would drop a user on an unrelated list.
  const goTo = (kind, id) => {
    setSearchOpen(false);
    setQuery("");
    if (kind === "medicine") navigate(`/medicines/${id}`);
    else if (kind === "supplier") navigate(`/suppliers?id=${id}`);
    else if (kind === "batch") navigate(`/batches?id=${id}`);
    else if (kind === "purchase") navigate(`/purchases?id=${id}`);
    else navigate(`/sales?id=${id}`);
  };

  const handleLogout = () => {
    logout();
    toast.info("Logged out", "You have been signed out.");
    navigate("/login");
  };

  const canAcknowledge = ACKNOWLEDGE_ROLES.includes(user?.role);

  const acknowledge = async (id) => {
    try {
      await api.markNotificationRead(id);
      await loadNotifications();
      toast.success("Alert reviewed", "Your name is recorded as the reviewer.");
    } catch (error) {
      toast.error("Could not acknowledge", error.message);
    }
  };

  return (
    <header className="topbar">
      <button className="topbar-btn" onClick={onToggleSidebar} aria-label="Toggle sidebar">
        <Menu size={20} />
      </button>

      <nav className="breadcrumb" aria-label="Breadcrumb">
        <span>PharmaStock</span>
        <ChevronRight className="sep" size={14} />
        <span className="breadcrumb-current">{current}</span>
      </nav>

      <div className="topbar-spacer" />

      {/* Global search */}
      <div className="global-search" ref={searchRef}>
        <button
          className="topbar-btn"
          style={{ background: "var(--surface)", width: "100%", justifyContent: "flex-start", padding: "0 14px", gap: 10 }}
          onClick={() => setSearchOpen((v) => !v)}
          aria-label="Open global search"
        >
          <Search size={17} />
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Search medicines, batches...</span>
        </button>
        {searchOpen && (
          <div className="global-search-results">
            <div className="search-input-wrap" style={{ padding: "0 6px 8px" }}>
              <span className="search-icon">
                <Search size={15} />
              </span>
              <input
                className="search-input"
                placeholder="Start typing..."
                value={query}
                autoFocus
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            {!searchResults && (
              <div className="search-group-label">Type to search across medicines, batches, suppliers &amp; transactions</div>
            )}
            {searchResults && !hasResults && <div className="search-group-label">No results found</div>}
            {searchResults?.medicines.length > 0 && (
              <>
                <div className="search-group-label">Medicines</div>
                {searchResults.medicines.map((m) => (
                  <div key={m.id} className="search-result-item" onClick={() => goTo("medicine", m.id)}>
                    <PillIcon />
                    <span>{m.name}</span>
                    <span className="sri-sub">{m.category}</span>
                  </div>
                ))}
              </>
            )}
            {searchResults?.suppliers.length > 0 && (
              <>
                <div className="search-group-label">Suppliers</div>
                {searchResults.suppliers.map((s) => (
                  <div key={s.id} className="search-result-item" onClick={() => goTo("supplier", s.id)}>
                    <TruckIcon />
                    <span>{s.name}</span>
                  </div>
                ))}
              </>
            )}
            {searchResults?.batches.length > 0 && (
              <>
                <div className="search-group-label">Batches</div>
                {searchResults.batches.map((b) => (
                  <div key={b.id} className="search-result-item" onClick={() => goTo("batch", b.id)}>
                    <LayersIcon />
                    <span>{b.batchNo} · {b.medicineName}</span>
                  </div>
                ))}
              </>
            )}
            {searchResults?.transactions.length > 0 && (
              <>
                <div className="search-group-label">Transactions</div>
                {searchResults.transactions.map((t) => (
                  <div key={t.id} className="search-result-item" onClick={() => goTo(t.kind, t.id)}>
                    <DocIcon />
                    <span>{t.label}</span>
                    <span className="sri-sub">{t.kindLabel}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Notifications */}
      <div style={{ position: "relative" }} ref={notifRef}>
        <button className="topbar-btn" onClick={() => setNotifOpen((v) => !v)} aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} awaiting review` : "Notifications"}>
          <Bell size={19} />
          {unreadCount > 0 && <span className="notif-dot">{unreadCount > 99 ? "99+" : unreadCount}</span>}
        </button>
        {notifOpen && (
          <div className="notif-panel">
            <div className="notif-header">
              <span>Alerts awaiting review</span>
              <button className="icon-btn" onClick={() => setNotifOpen(false)} aria-label="Close notifications">
                <ChevronRight size={16} style={{ transform: "rotate(90deg)" }} />
              </button>
            </div>
            {/* The badge counts alerts that no member of staff has reviewed yet.
                These alerts are shared, so the panel says so instead of implying
                a personal inbox. */}
            <div className="notif-list">
              {notifs.map((n) => {
                const meta = NOTIF_META[n.type] || NOTIF_META.system;
                return (
                  <div className="notif-item" key={n.id}>
                    <div className={`notif-type ${meta.tone}`}>
                      <NotifIcon type={n.type} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13.5 }}>{n.title}</div>
                      <div className="muted text-sm">{n.message}</div>
                      <div className="muted text-sm" style={{ fontSize: 11.5, marginTop: 2 }}>
                        {n.time}
                        {n.read && n.acknowledgedByEmail ? ` · reviewed by ${n.acknowledgedByEmail}` : ""}
                      </div>
                    </div>
                    {!n.read && canAcknowledge && (
                      <button
                        type="button"
                        className="btn btn-sm"
                        data-testid={`acknowledge-${n.id}`}
                        style={{ marginLeft: "auto", alignSelf: "flex-start", flexShrink: 0 }}
                        onClick={() => acknowledge(n.id)}
                      >
                        <Check size={13} /> Mark reviewed
                      </button>
                    )}
                  </div>
                );
              })}
              {notifs.length === 0 && <p className="muted text-sm" style={{ padding: 10 }}>No alerts to review.</p>}
            </div>
          </div>
        )}
      </div>

      {/* User */}
      <div style={{ position: "relative" }} ref={userRef}>
        <button data-testid="account-menu" className="topbar-user" onClick={() => setUserMenu((v) => !v)} aria-label="Account menu">
          <div className="topbar-user-meta">
            <span style={{ fontWeight: 600, fontSize: 13 }}>{user?.name || "Guest"}</span>
            <span className="muted text-sm">{user?.role || "—"}</span>
          </div>
          <div className="avatar">{user?.avatar || "U"}</div>
        </button>
        {userMenu && (
          <div className="menu-panel">
            <button className="menu-item" onClick={() => { setUserMenu(false); navigate("/profile"); }}>
              <UserCircle size={16} /> Profile
            </button>
            <button className="menu-item" onClick={() => { setUserMenu(false); navigate("/settings"); }}>
              <Settings size={16} /> Settings
            </button>
            <div className="divider" style={{ margin: "4px 10px" }} />
            <button data-testid="logout" className="menu-item danger" onClick={handleLogout}>
              <LogOut size={16} /> Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

function PillIcon() {
  return <span style={{ color: "var(--accent)" }}><Pill size={16} /></span>;
}
function TruckIcon() {
  return <span style={{ color: "var(--info)" }}><Truck size={16} /></span>;
}
function LayersIcon() {
  return <span style={{ color: "var(--warning)" }}><Layers size={16} /></span>;
}
function DocIcon() {
  return <span style={{ color: "var(--text-secondary)" }}><FileText size={16} /></span>;
}
function NotifIcon({ type }) {
  const map = {
    low: "⚠",
    expiry: "⏳",
    expired: "✕",
    system: "ℹ",
    sale: "✔",
    purchase: "＋",
  };
  return <span style={{ fontWeight: 700 }}>{map[type] || "•"}</span>;
}
