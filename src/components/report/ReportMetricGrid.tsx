import React from "react";

interface MetricItem {
  label: string;
  value: string;
  note?: string;
}

interface Props {
  items: MetricItem[];
  columns?: number;
}

const MONO = "'JetBrains Mono', 'Courier New', monospace";

export default function ReportMetricGrid({ items, columns = 3 }: Props) {
  return (
    <div className="report-metric-grid" style={{
      display: "grid",
      gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      gap: 0,
    }}>
      {items.map((item, i) => (
        <div key={item.label} style={{
          padding: "8px 14px",
          borderRight: (i + 1) % columns !== 0 ? "1px solid #f1f5f9" : "none",
          borderBottom: i < items.length - columns ? "1px solid #f1f5f9" : "none",
        }}>
          <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 4 }}>
            {item.label}
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", fontFamily: MONO, letterSpacing: "-0.5px" }}>
            {item.value}
          </div>
          {item.note && (
            <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{item.note}</div>
          )}
        </div>
      ))}
    </div>
  );
}
