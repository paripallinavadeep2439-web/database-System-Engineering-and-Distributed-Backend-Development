import { ArrowUpRight, ArrowDownRight } from "lucide-react";

export default function AnalyticsCard({ label, value, delta, trend = "up", sub, testId }) {
  return (
    <div data-testid={testId} className="card card-hover">
      <div className="card-sub">{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "var(--font-display)", margin: "6px 0 4px" }}>{value}</div>
      <div className="flex gap-8">
        <span className={`stat-delta ${trend === "up" ? "positive" : "negative"}`}>
          {trend === "up" ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
          {delta}
        </span>
        {sub && <span className="muted text-sm">{sub}</span>}
      </div>
    </div>
  );
}
