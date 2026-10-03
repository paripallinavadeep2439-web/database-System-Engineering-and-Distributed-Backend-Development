const SEGMENTS = [
  { key: "healthy", label: "Healthy", color: "#34d399" },
  { key: "lowStock", label: "Low Stock", color: "#fbbf24" },
  { key: "critical", label: "Critical", color: "#f87171" },
  { key: "expired", label: "Expired", color: "#94a3b8" },
];

export default function InventoryHealth({ data }) {
  const total = Object.values(data).reduce((s, v) => s + v, 0) || 1;
  return (
    <div>
      <div className="flex" style={{ gap: 16, alignItems: "flex-end", height: 140 }}>
        {SEGMENTS.map((seg) => {
          const value = data[seg.key] || 0;
          const pct = (value / total) * 100;
          return (
            <div key={seg.key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{value}</div>
              <div style={{ width: "100%", display: "flex", alignItems: "flex-end", height: 96 }}>
                <div
                  style={{
                    width: "100%",
                    height: `${Math.max(pct, 4)}%`,
                    borderRadius: 8,
                    background: seg.color,
                    opacity: 0.85,
                    transition: "height 0.4s ease",
                  }}
                  role="img"
                  aria-label={`${seg.label}: ${value}`}
                />
              </div>
              <div className="muted text-sm" style={{ textAlign: "center" }}>{seg.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
