import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { formatINRCompact } from "../../utils/formatters";

export default function SalesChart({ data }) {
  return (
    <div className="chart-box chart-height-md">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="month" stroke="var(--text-muted)" tickLine={false} axisLine={false} dy={8} />
          <YAxis
            stroke="var(--text-muted)"
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => formatINRCompact(v)}
            width={58}
          />
          <Tooltip
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12 }}
            labelStyle={{ color: "var(--text-primary)", fontWeight: 600 }}
            formatter={(value) => formatINRCompact(value)}
          />
          <Legend wrapperStyle={{ color: "var(--text-secondary)" }} />
          <Line type="monotone" dataKey="sales" name="Sales" stroke="#14b8a6" strokeWidth={3} dot={{ r: 3, fill: "#14b8a6" }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
