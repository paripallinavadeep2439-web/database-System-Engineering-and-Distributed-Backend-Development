import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import ToastStack from "../common/Toast";
import { useSettings } from "../../contexts/SettingsContext";

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { settings } = useSettings();
  const location = useLocation();

  const toggleSidebar = () => {
    if (window.innerWidth <= 880) {
      setSidebarOpen((v) => !v);
    } else {
      setCollapsed((v) => !v);
    }
  };

  return (
    <div className={`app-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
      <Sidebar collapsed={collapsed} open={sidebarOpen} onCloseMobile={() => setSidebarOpen(false)} />
      <div className="app-main">
        <Topbar onToggleSidebar={toggleSidebar} />
        <main className="app-content" key={location.pathname}>
          <Outlet />
        </main>
      </div>
      <ToastStack />
    </div>
  );
}
