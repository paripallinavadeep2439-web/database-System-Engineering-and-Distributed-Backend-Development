import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { formatINRCompact } from "../../utils/formatters";

export default function InventoryChart({ data }) {
  return (
    <div className="chart-box chart-height-md">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="invGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#14b8a6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="month" stroke="var(--text-muted)" tickLine={false} axisLine={false} dy={8} />
          <YAxis stroke="var(--text-muted)" tickLine={false} axisLine={false} tickFormatter={(v) => formatINRCompact(v)} width={58} />
          <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12 }} formatter={(v) => formatINRCompact(v)} />
          <Area type="monotone" dataKey="value" name="Inventory Value" stroke="#14b8a6" strokeWidth={2.5} fill="url(#invGrad)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
