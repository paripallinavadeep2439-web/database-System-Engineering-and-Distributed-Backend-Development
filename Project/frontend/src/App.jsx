import { Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import { useAuth } from "./contexts/AuthContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Medicines from "./pages/Medicines";
import MedicineDetails from "./pages/MedicineDetails";
import Batches from "./pages/Batches";
import LowStock from "./pages/LowStock";
import Expiry from "./pages/Expiry";
import Suppliers from "./pages/Suppliers";
import Purchases from "./pages/Purchases";
import Sales from "./pages/Sales";
import Analytics from "./pages/Analytics";
import Reports from "./pages/Reports";
import Users from "./pages/Users";
import Adjustments from "./pages/Adjustments";
import AuditLog from "./pages/AuditLog";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

function RequireAuth({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <div className="page-loading">Loading your workspace...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

function RoleRoute({ roles, children }) {
  const { user } = useAuth();
  if (!roles.includes(user?.role)) return <Navigate to="/dashboard" replace />;
  return children;
}

function ProtectedLayout() {
  return (
    <RequireAuth>
      <AppLayout />
    </RequireAuth>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<ProtectedLayout />}>
        <Route index element={<Dashboard />} />
      </Route>
      <Route path="/medicines" element={<ProtectedLayout />}>
        <Route index element={<Medicines />} />
        <Route path=":id" element={<MedicineDetails />} />
      </Route>
      <Route path="/batches" element={<ProtectedLayout />}>
        <Route index element={<Batches />} />
      </Route>
      <Route path="/low-stock" element={<ProtectedLayout />}>
        <Route index element={<LowStock />} />
      </Route>
      <Route path="/expiry" element={<ProtectedLayout />}>
        <Route index element={<Expiry />} />
      </Route>
      <Route path="/suppliers" element={<ProtectedLayout />}>
        <Route index element={<Suppliers />} />
      </Route>
      <Route path="/purchases" element={<ProtectedLayout />}>
        <Route index element={<Purchases />} />
      </Route>
      <Route path="/sales" element={<ProtectedLayout />}>
        <Route index element={<Sales />} />
      </Route>
      <Route path="/analytics" element={<ProtectedLayout />}>
        <Route index element={<Analytics />} />
      </Route>
      <Route path="/reports" element={<ProtectedLayout />}>
        <Route index element={<Reports />} />
      </Route>
      <Route path="/adjustments" element={<ProtectedLayout />}>
        <Route index element={<RoleRoute roles={["Admin", "Inventory Manager", "Pharmacist"]}><Adjustments /></RoleRoute>} />
      </Route>
      <Route path="/users" element={<ProtectedLayout />}>
        <Route index element={<RoleRoute roles={["Admin"]}><Users /></RoleRoute>} />
      </Route>
      <Route path="/audit-log" element={<ProtectedLayout />}>
        <Route index element={<RoleRoute roles={["Admin"]}><AuditLog /></RoleRoute>} />
      </Route>
      <Route path="/profile" element={<ProtectedLayout />}>
        <Route index element={<Profile />} />
      </Route>
      <Route path="/settings" element={<ProtectedLayout />}>
        <Route index element={<Settings />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
