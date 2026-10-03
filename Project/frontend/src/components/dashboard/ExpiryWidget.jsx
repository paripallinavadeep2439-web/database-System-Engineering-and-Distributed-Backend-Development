import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";

const COLORS = ["#14b8a6", "#38bdf8", "#fbbf24", "#a78bfa", "#34d399", "#f87171"];

export default function ExpiryWidget({ data }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <div className="donut-center chart-height-sm">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="count" nameKey="range" innerRadius="62%" outerRadius="88%" paddingAngle={3} stroke="none">
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12 }} formatter={(v, n) => [`${v} batches`, n]} />
        </PieChart>
      </ResponsiveContainer>
      <div className="donut-center-label">
        <div className="dcl-value">{total}</div>
        <div className="dcl-label">Batches</div>
      </div>
    </div>
  );
}
