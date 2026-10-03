import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Pill,
  Layers,
  AlertTriangle,
  CalendarClock,
  Truck,
  ShoppingCart,
  ShoppingBag,
  SlidersHorizontal,
  ScrollText,
  BarChart3,
  FileText,
  Users,
  Settings,
  LogOut,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";

const NAV = [
  { group: "Overview", items: [{ to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, key: "dashboard" }] },
  {
    group: "Inventory",
    items: [
      { to: "/medicines", label: "Medicines", icon: Pill, key: "medicines" },
      { to: "/batches", label: "Batches", icon: Layers, key: "batches" },
      { to: "/low-stock", label: "Low Stock", icon: AlertTriangle, key: "low-stock" },
      { to: "/expiry", label: "Expiry", icon: CalendarClock, key: "expiry" },
    ],
  },
  {
    group: "Operations",
    items: [
      { to: "/suppliers", label: "Suppliers", icon: Truck, key: "suppliers" },
      { to: "/purchases", label: "Purchases", icon: ShoppingCart, key: "purchases" },
      { to: "/sales", label: "Sales", icon: ShoppingBag, key: "sales" },
      // Adjustments are the only way stock leaves without a sale, so the ledger
      // that explains every quantity change has to be reachable from the UI.
      { to: "/adjustments", label: "Adjustments", icon: SlidersHorizontal, key: "adjustments", roles: ["Admin", "Inventory Manager", "Pharmacist"] },
    ],
  },
  {
    group: "Insights",
    items: [
      { to: "/analytics", label: "Analytics", icon: BarChart3, key: "analytics" },
      { to: "/reports", label: "Reports", icon: FileText, key: "reports" },
    ],
  },
  {
    group: "Administration",
    items: [
      { to: "/users", label: "Users", icon: Users, key: "users", roles: ["Admin"] },
      { to: "/audit-log", label: "Audit Log", icon: ScrollText, key: "audit-log", roles: ["Admin"] },
      { to: "/settings", label: "Settings", icon: Settings, key: "settings" },
    ],
  },
];

export default function Sidebar({ collapsed, open, onCloseMobile }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const role = user?.role || "Administrator";

  const handleLogout = () => {
    logout();
    toast.info("Logged out", "You have been signed out.");
    navigate("/login");
  };

  return (
    <>
      {open && <div className="sidebar-overlay" onClick={onCloseMobile} aria-hidden="true" />}
      <aside
        className={`sidebar ${open ? "open" : ""} ${collapsed ? "sidebar-collapsed" : ""}`}
        aria-label="Primary navigation"
      >
        <div className="sidebar-brand">
          <div className="brand-logo">
            <LayoutDashboard size={22} />
          </div>
          <div className="brand-text">
            <span className="brand-name">PharmaStock</span>
            <span className="brand-sub">Medicine Inventory</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV.map((group) => (
            <div key={group.group}>
              <div className="nav-group-label">{group.group}</div>
              {group.items.filter((item) => !item.roles || item.roles.includes(user?.role)).map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
                  onClick={onCloseMobile}
                  title={collapsed ? item.label : undefined}
                >
                  <item.icon className="nav-icon" size={18} />
                  <span className="nav-label">{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="avatar avatar-sm">{user?.avatar || "SR"}</div>
            <div className="user-meta">
              <span className="user-name">{user?.name || "Shiva Reddy"}</span>
              <span className="user-role">{role}</span>
            </div>
            <button className="icon-btn" onClick={handleLogout} aria-label="Logout" title="Logout">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
