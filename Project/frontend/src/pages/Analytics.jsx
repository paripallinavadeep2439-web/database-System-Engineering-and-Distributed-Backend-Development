import { useEffect, useMemo, useState } from "react";
import { TrendingUp, Wallet, RefreshCw, Star } from "lucide-react";
import PageHeader from "../components/layout/PageHeader";
import AnalyticsCard from "../components/analytics/AnalyticsCard";
import InventoryChart from "../components/analytics/InventoryChart";
import SalesAnalytics from "../components/analytics/SalesAnalytics";
import LoadingState from "../components/common/LoadingState";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { formatINRCompact } from "../utils/formatters";
import { DATE_RANGES } from "../utils/constants";
import * as api from "../services/api";

const DONUT_COLORS = ["#14b8a6", "#38bdf8", "#fbbf24", "#a78bfa", "#34d399", "#f87171", "#2dd4bf", "#f0abfc"];

function rangeDates(value) {
  const days = DATE_RANGES.find((item) => item.value === value)?.days || 90;
  const to = new Date();
  const from = new Date(to.getTime() - days * 86400000);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export default function Analytics() {
  const [range, setRange] = useState("90D");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    setData(null);
    setError("");
    api.getAnalytics(rangeDates(range)).then((result) => {
      if (mounted) setData(result);
    }).catch((requestError) => {
      if (mounted) setError(requestError.message || "Could not load analytics.");
    });
    return () => { mounted = false; };
  }, [range]);

  const summary = data?.summary || {};
  const trend = data?.trend || [];
  const topSelling = data?.topSelling || [];
  const slowMoving = data?.slowMoving || [];
  const category = data?.category || [];
  const supplierPerformance = data?.supplierPerformance || [];
  const expiryRisk = data?.expiryRisk || [];
  const maxTop = topSelling[0]?.value || 1;
  const revenue = Number(summary.revenue || 0);
  const inventoryValue = Number(summary.inventoryValue || 0);
  const cogs = Number(summary.cogs || 0);
  const grossProfit = Number(summary.grossProfit || 0);
  const profitPct = Number(summary.grossMargin || 0);
  const turnover = Number(summary.turnover || 0);
  const formattedProfit = useMemo(() => `${profitPct.toFixed(1)}%`, [profitPct]);

  if (error) return <div className="card muted">{error}</div>;
  if (!data) return <LoadingState rows={5} />;

  return (
    <div>
      <PageHeader title="Analytics" subtitle="Business intelligence for your pharmaceutical inventory." actions={<div className="date-range-group" role="group" aria-label="Date range">{DATE_RANGES.map((item) => <button data-testid={`analytics-range-${item.value}`} key={item.value} className={`date-range-btn ${range === item.value ? "active" : ""}`} onClick={() => setRange(item.value)}>{item.label}</button>)}</div>} />
      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        <AnalyticsCard testId="analytics-revenue" label="Revenue" value={formatINRCompact(revenue)} delta="Selected period" trend="neutral" sub="completed sales" />
        <AnalyticsCard testId="analytics-cogs" label="COGS" value={formatINRCompact(cogs)} delta="Selected period" trend="neutral" sub="FEFO allocation cost" />
        <AnalyticsCard testId="analytics-gross-profit" label="Gross Profit" value={formatINRCompact(grossProfit)} delta="Selected period" trend="neutral" sub="revenue - COGS" />
        <AnalyticsCard testId="analytics-gross-margin" label="Gross Margin" value={formattedProfit} delta="Selected period" trend="neutral" sub="gross profit / revenue" />
        <AnalyticsCard label="Inventory Value" value={formatINRCompact(inventoryValue)} delta="Current cost value" trend="neutral" sub="active stock" />
        <AnalyticsCard label="Stock Turnover" value={`${turnover.toFixed(2)}x`} delta="Selected period" trend="neutral" sub="revenue / stock value" />
      </div>
      <div className="grid grid-2" style={{ marginBottom: 20 }}>
        <div className="card"><div className="card-header"><div><div className="card-title">Revenue Analytics</div><div className="card-sub">Monthly purchase, sales and net comparison</div></div><TrendingUp size={18} className="muted" /></div><SalesAnalytics data={trend.map((item) => ({ ...item, profit: item.sales - item.purchases }))} /></div>
        <div className="card"><div className="card-header"><div><div className="card-title">Inventory Value</div><div className="card-sub">Value of stock on hand by month</div></div><Wallet size={18} className="muted" /></div><InventoryChart data={trend.map((item) => ({ month: item.month, value: inventoryValue }))} /></div>
      </div>
      <div className="grid grid-2" style={{ marginBottom: 20 }}>
        <div className="card"><div className="card-header"><div><div className="card-title">Top-Selling Medicines</div><div className="card-sub">By revenue</div></div><Star size={18} className="muted" /></div>{topSelling.length === 0 ? <div className="muted">No sales in this period.</div> : topSelling.map((item) => <div className="flex-between" style={{ padding: "9px 0", borderBottom: "1px solid var(--border)" }} key={item.name}><span className="text-sm">{item.name}</span><div className="flex gap-12"><span className="muted text-sm">{formatINRCompact(item.value)}</span><div className="progress-track" style={{ width: 120 }}><div className="progress-fill" style={{ width: `${Math.max(0, Math.min(100, (item.value / maxTop) * 100))}%` }} /></div></div></div>)}</div>
        <div className="card"><div className="card-header"><div><div className="card-title">Slow-Moving Medicines</div><div className="card-sub">Lowest turnover — review stock allocation</div></div><RefreshCw size={18} className="muted" /></div>{slowMoving.length === 0 ? <div className="muted">No sales in this period.</div> : slowMoving.map((item) => <div className="flex-between" style={{ padding: "9px 0", borderBottom: "1px solid var(--border)" }} key={item.name}><span className="text-sm">{item.name}</span><span className="muted text-sm">{formatINRCompact(item.value)}</span></div>)}</div>
      </div>
      <div className="grid grid-3">
        <div className="card"><div className="card-header"><div className="card-title">Category Performance</div><div className="card-sub">Stock by category</div></div><div className="chart-box chart-height-md"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={category} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="80%" paddingAngle={2} stroke="none">{category.map((_, index) => <Cell key={index} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />)}</Pie><Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12 }} /></PieChart></ResponsiveContainer></div></div>
        <div className="card"><div className="card-header"><div className="card-title">Supplier Performance</div><div className="card-sub">Payment completion rate</div></div><div className="chart-box chart-height-md"><ResponsiveContainer width="100%" height="100%"><BarChart data={supplierPerformance} layout="vertical" margin={{ left: 12, right: 12 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} /><XAxis type="number" domain={[0, 100]} hide /><YAxis type="category" dataKey="name" width={130} stroke="var(--text-muted)" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} /><Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12 }} /><Bar dataKey="active" name="Completion" fill="#14b8a6" radius={[0, 6, 6, 0]} /></BarChart></ResponsiveContainer></div></div>
        <div className="card"><div className="card-header"><div className="card-title">Expiry Risk</div><div className="card-sub">Batches by expiry window</div></div><div className="chart-box chart-height-md"><ResponsiveContainer width="100%" height="100%"><BarChart data={expiryRisk} layout="vertical" margin={{ left: 12, right: 12 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} /><XAxis type="number" hide /><YAxis type="category" dataKey="label" width={80} stroke="var(--text-muted)" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} /><Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12 }} cursor={{ fill: "var(--bg-tertiary)" }} /><Bar dataKey="value" name="Batches" radius={[0, 6, 6, 0]}>{expiryRisk.map((item, index) => <Cell key={index} fill={item.color} />)}</Bar></BarChart></ResponsiveContainer></div></div>
      </div>
    </div>
  );
}
