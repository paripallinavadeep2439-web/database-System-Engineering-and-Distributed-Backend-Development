import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

const ICON_TONES = {
  emerald: { bg: "rgba(52, 211, 153, 0.14)", color: "#34d399" },
  teal: { bg: "rgba(20, 184, 166, 0.14)", color: "#14b8a6" },
  amber: { bg: "rgba(251, 191, 36, 0.14)", color: "#fbbf24" },
  red: { bg: "rgba(248, 113, 113, 0.14)", color: "#f87171" },
  blue: { bg: "rgba(56, 189, 248, 0.14)", color: "#38bdf8" },
  violet: { bg: "rgba(167, 139, 250, 0.14)", color: "#a78bfa" },
};

export default function StatCard({ label, value, delta, trend = "up", sub, icon: Icon, tone = "teal", valuePrefix, children }) {
  const t = ICON_TONES[tone] || ICON_TONES.teal;
  return (
    <div className="stat-card" style={{ "--stat-bg": t.bg, "--stat-color": t.color, "--stat-glow": t.bg }}>
      <div className="flex-between" style={{ alignItems: "flex-start" }}>
        <div className="stat-label">{label}</div>
        <div className="stat-icon">
          {Icon && <Icon size={20} />}
        </div>
      </div>
      <div className="stat-value">{valuePrefix}{value}</div>
      {children}
      <div className="stat-figure-row">
        {delta && (
          <span className={`stat-delta ${trend === "up" ? "positive" : trend === "down" ? "negative" : "neutral"}`}>
            {trend === "up" && <ArrowUpRight size={13} />}
            {trend === "down" && <ArrowDownRight size={13} />}
            {trend === "neutral" && <Minus size={13} />}
            {delta}
          </span>
        )}
        {sub && <span className="muted text-sm">{sub}</span>}
      </div>
    </div>
  );
}
