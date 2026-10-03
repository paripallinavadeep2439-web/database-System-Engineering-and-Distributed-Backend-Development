import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { formatINRCompact } from "../../utils/formatters";

export default function SalesAnalytics({ data }) {
  return (
    <div className="chart-box chart-height-lg">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="month" stroke="var(--text-muted)" tickLine={false} axisLine={false} dy={8} />
          <YAxis stroke="var(--text-muted)" tickLine={false} axisLine={false} tickFormatter={(v) => formatINRCompact(v)} width={58} />
          <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12 }} formatter={(v) => formatINRCompact(v)} cursor={{ fill: "var(--bg-tertiary)" }} />
          <Legend wrapperStyle={{ color: "var(--text-secondary)" }} />
          <Bar dataKey="sales" name="Sales" fill="#14b8a6" radius={[6, 6, 0, 0]} maxBarSize={26} />
          <Bar dataKey="purchases" name="Purchases" fill="#38bdf8" radius={[6, 6, 0, 0]} maxBarSize={26} />
          <Line type="monotone" dataKey="profit" name="Net" stroke="#fbbf24" strokeWidth={2.5} dot={{ r: 3, fill: "#fbbf24" }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
