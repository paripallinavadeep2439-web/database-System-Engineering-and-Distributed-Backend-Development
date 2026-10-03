import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { formatINRCompact } from "../../utils/formatters";

export default function StockOverview({ data }) {
  return (
    <div className="chart-box chart-height-md">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }} barGap={6}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="month" stroke="var(--text-muted)" tickLine={false} axisLine={false} dy={8} />
          <YAxis stroke="var(--text-muted)" tickLine={false} axisLine={false} tickFormatter={(v) => formatINRCompact(v)} width={58} />
          <Tooltip
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12 }}
            labelStyle={{ color: "var(--text-primary)", fontWeight: 600 }}
            formatter={(value) => formatINRCompact(value)}
            cursor={{ fill: "var(--bg-tertiary)" }}
          />
          <Legend wrapperStyle={{ color: "var(--text-secondary)" }} />
          <Bar dataKey="sales" name="Sales" fill="#14b8a6" radius={[6, 6, 0, 0]} maxBarSize={22} />
          <Bar dataKey="purchases" name="Purchases" fill="#38bdf8" radius={[6, 6, 0, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
