import React from "react";

interface Metric {
  label: string;
  value: string;
  trend: number;
  suffix: string;
}

function MetricCard({ label, value, trend, suffix }: Metric) {
  const hasUp = trend > 0;
  const hasDown = trend < 0;
  return (
    <div style={styles.card}>
      <div style={styles.label}>{label}</div>
      <div style={styles.value}>{value}</div>
      <div style={styles.footer}>
        <span style={{ ...styles.trend, color: hasUp ? "#16a34a" : hasDown ? "#dc2626" : "#64748b" }}>
          {hasUp ? "▲" : "▼"} {Math.abs(trend).toFixed(1).replace(".", ",")}%
        </span>
        <span style={styles.suffix}>{suffix}</span>
      </div>
    </div>
  );
}

export default function MetricsRow({ metrics }: { metrics: Metric[] }) {
  return (
    <div className="metrics-row" style={styles.row}>
      {metrics.map(m => <MetricCard key={m.label} {...m} />)}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  row: {
    display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 1,
    background: "#e2e8f0", borderBottom: "1px solid #e2e8f0",
  },
  card: { background: "#fff", padding: "14px 18px", cursor: "default" },
  label: { fontSize: 11, color: "#94a3b8", fontWeight: 500, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.4px" },
  value: {
    fontSize: 18, fontWeight: 700, color: "#0f172a",
    fontFamily: "'JetBrains Mono', monospace", letterSpacing: "-0.5px", marginBottom: 4,
  },
  footer: { display: "flex", alignItems: "center", gap: 6 },
  trend: { fontSize: 11, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" },
  suffix: { fontSize: 10, color: "#cbd5e1" },
};
