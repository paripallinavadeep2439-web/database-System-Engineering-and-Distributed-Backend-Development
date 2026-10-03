import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Pill, Boxes, AlertTriangle, CalendarClock, Wallet, TrendingUp, ArrowRight } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import * as api from "../services/api";
import StatCard from "../components/dashboard/StatCard";
import SalesChart from "../components/dashboard/SalesChart";
import StockOverview from "../components/dashboard/StockOverview";
import ExpiryWidget from "../components/dashboard/ExpiryWidget";
import InventoryHealth from "../components/dashboard/InventoryHealth";
import LoadingState from "../components/common/LoadingState";
import { formatINR, formatINRCompact, formatNumber } from "../utils/formatters";

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    api.getDashboardData().then((d) => {
      if (mounted) setData(d);
    }).catch((requestError) => {
      if (mounted) setError(requestError.message || "Could not load dashboard.");
    });
    return () => { mounted = false; };
  }, []);

  if (error) return <div className="card muted">{error}</div>;
  if (!data) {
    return (
      <div style={{ paddingTop: 8 }}>
        <LoadingState rows={3} />
      </div>
    );
  }

  const k = data.kpis;
  const firstName = (user?.name || "User").split(" ")[0];

  const lowStockList = (data.lowStockAlerts || []).slice(0, 5);
  const expiring = (data.expiringSoon || []).slice(0, 5);

  return (
    <div>
      <div className="page-header animate-in">
        <div>
          <h1 className="ph-title">Good {goodTime()}, {firstName}</h1>
          <p className="ph-sub">Here's your pharmaceutical inventory overview for today.</p>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-stat" style={{ marginBottom: 20 }}>
        <StatCard label="Total Medicines" value={k.totalMedicines.value} delta={k.totalMedicines.delta} trend={k.totalMedicines.trend} sub={k.totalMedicines.label} icon={Pill} tone="teal" />
        <StatCard label="Total Stock Units" value={formatNumber(k.totalStockUnits.value)} delta={k.totalStockUnits.delta} trend={k.totalStockUnits.trend} sub={k.totalStockUnits.label} icon={Boxes} tone="blue" />
        <StatCard label="Low Stock" value={k.lowStock.value} delta={k.lowStock.delta} trend={k.lowStock.trend} sub={k.lowStock.label} icon={AlertTriangle} tone="amber" />
        <StatCard label="Near Expiry" value={k.nearExpiry.value} delta={k.nearExpiry.delta} trend={k.nearExpiry.trend} sub={k.nearExpiry.label} icon={CalendarClock} tone="red" />
        <StatCard label="Inventory Value" value={formatINRCompact(k.inventoryValue.value)} delta={k.inventoryValue.delta} trend={k.inventoryValue.trend} sub={k.inventoryValue.label} icon={Wallet} tone="violet" />
        <StatCard label="Monthly Sales" value={formatINRCompact(k.monthlySales.value)} delta={k.monthlySales.delta} trend={k.monthlySales.trend} sub={k.monthlySales.label} icon={TrendingUp} tone="emerald" />
      </div>

      {/* Charts row */}
      <div className="grid grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Sales Trend</div>
              <div className="card-sub">Monthly completed sales</div>
            </div>
          </div>
          <SalesChart data={data.salesTrend} />
        </div>
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Purchase vs Sales</div>
              <div className="card-sub">Monthly comparison</div>
            </div>
          </div>
          <StockOverview data={data.salesTrend} />
        </div>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Inventory by Category</div>
              <div className="card-sub">Stock units per category</div>
            </div>
          </div>
          <div className="chart-box chart-height-md">
            <DataDonut data={data.category} />
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Stock Health</div>
              <div className="card-sub">By batch status</div>
            </div>
          </div>
          <InventoryHealth data={data.stockHealth} />
          <div className="legend-row" style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 14 }}>
            {["Healthy", "Low Stock", "Critical", "Expired"].map((l) => (
              <span className="chart-legend-item" key={l}>
                <span className="chart-legend-dot" style={{ background: l === "Healthy" ? "#34d399" : l === "Low Stock" ? "#fbbf24" : l === "Critical" ? "#f87171" : "#94a3b8" }} />
                {l}
              </span>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Expiry Timeline</div>
              <div className="card-sub">Days until expiry</div>
            </div>
          </div>
          <ExpiryWidget data={data.expiryTimeline} />
        </div>
      </div>

      {/* Alert lists */}
      <div className="grid grid-2">
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Low Stock Alerts</div>
              <div className="card-sub">Items under reorder level</div>
            </div>
            <Link to="/low-stock" className="btn btn-ghost btn-sm">View all <ArrowRight size={14} /></Link>
          </div>
          {lowStockList.length === 0 ? (
            <div className="muted text-sm">All medicines are sufficiently stocked.</div>
          ) : (
            lowStockList.map((m) => {
              const ratio = m.stock / m.reorderLevel;
              const sev = ratio < 0.3 ? "critical" : "warning";
              return (
                <div className={`alert-row ${sev}`} key={m.id}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{m.name}</div>
                    <div className="muted text-sm">{m.generic}</div>
                  </div>
                  <div className="summary-strip">
                    <div className="summary-item">
                      <span className="si-label">Stock</span>
                      <span className="si-value">{m.stock}</span>
                    </div>
                    <div className="summary-item">
                      <span className="si-label">Reorder</span>
                      <span className="si-value">{m.reorderLevel}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Expiring Soon</div>
              <div className="card-sub">Batches within 30 days</div>
            </div>
            <Link to="/expiry" className="btn btn-ghost btn-sm">View all <ArrowRight size={14} /></Link>
          </div>
          {expiring.length === 0 ? (
            <div className="muted text-sm">No batches expiring soon.</div>
          ) : (
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Batch</th>
                    <th>Medicine</th>
                    <th>Expiry</th>
                    <th>Days</th>
                  </tr>
                </thead>
                <tbody>
                  {expiring.map((b) => {
                    const d = b.days;
                    return (
                      <tr key={b.id}>
                        <td className="cell-primary">{b.batchNo}</td>
                        <td>{b.medicineName}</td>
                        <td className="muted">{b.expiryDate}</td>
                        <td><span className={`status-badge ${d <= 7 ? "status-danger" : "status-warning"}`}>{d} days</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";

const DONUT_COLORS = ["#14b8a6", "#38bdf8", "#fbbf24", "#a78bfa", "#34d399", "#f87171", "#2dd4bf", "#f0abfc"];

function DataDonut({ data }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="82%" paddingAngle={3} stroke="none">
          {data.map((_, i) => (
            <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12 }}
          labelStyle={{ color: "var(--text-primary)" }}
          formatter={(v, n) => [`${v} units`, n]}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

function goodTime() {
  const h = new Date().getHours();
  if (h < 12) return "Morning";
  if (h < 17) return "Afternoon";
  return "Evening";
}
