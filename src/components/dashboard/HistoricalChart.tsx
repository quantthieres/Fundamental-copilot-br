"use client";

import React, { useState } from "react";
import SectionCard from "./SectionCard";
import { formatFiscalYearRange } from "@/lib/formatters";

interface FinancialRow {
  year: string;
  receita: number;
  ebitda: number;
  fcl: number;
}

const METRICS = [
  { key: "receita" as const, label: "Receita",              color: "#2563eb" },
  { key: "ebitda"  as const, label: "EBITDA",               color: "#0ea5e9" },
  { key: "fcl"     as const, label: "Fluxo de Caixa Livre", color: "#38bdf8" },
];

export default function HistoricalChart({ data }: { data: FinancialRow[] }) {
  const [activeMetric, setActiveMetric] = useState<string>("all");

  const W = 560, H = 200, PAD = { top: 10, right: 10, bottom: 28, left: 52 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const visible = activeMetric === "all" ? METRICS : METRICS.filter(m => m.key === activeMetric);
  const allVals = data.flatMap(d => visible.map(m => d[m.key]));
  const maxVal = Math.ceil(Math.max(...allVals) / 10) * 10;

  const xStep = chartW / data.length;
  const barGroupW = xStep * 0.72;
  const barW = barGroupW / visible.length;
  const yTicks = [0, maxVal * 0.25, maxVal * 0.5, maxVal * 0.75, maxVal];
  const y = (v: number) => chartH - (v / maxVal) * chartH;

  const toggles = [{ key: "all", label: "Todos" }, ...METRICS];
  const yearRange = formatFiscalYearRange(data.map(d => d.year));

  return (
    <SectionCard
      title="Financeiros Históricos"
      subtitle={yearRange ? `BRL Bilhões · ${yearRange}` : "BRL Bilhões · Histórico anual"}
      action={
        <div style={{ display: "flex", gap: 2 }}>
          {toggles.map(t => (
            <button key={t.key} onClick={() => setActiveMetric(t.key)} style={{
              fontSize: 11, padding: "3px 8px", borderRadius: 5, cursor: "pointer",
              fontFamily: "inherit",
              ...(activeMetric === t.key
                ? { background: "#eff6ff", border: "1px solid #bfdbfe", color: "#2563eb", fontWeight: 600 }
                : { border: "1px solid #e2e8f0", background: "#f8fafc", color: "#64748b" }),
            }}>{t.label}</button>
          ))}
        </div>
      }
    >
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ overflow: "visible" }}>
        <g transform={`translate(${PAD.left},${PAD.top})`}>
          {yTicks.map((v, i) => (
            <g key={i}>
              <line x1={0} y1={y(v)} x2={chartW} y2={y(v)} stroke="#f1f5f9" strokeWidth={1}/>
              <text x={-6} y={y(v) + 4} textAnchor="end" fontSize={10} fill="#94a3b8"
                fontFamily="JetBrains Mono, monospace">
                {v === 0 ? "" : `R$${v}B`}
              </text>
            </g>
          ))}
          {data.map((d, di) => {
            const groupX = di * xStep + xStep * 0.14;
            return (
              <g key={d.year}>
                {visible.map((m, mi) => {
                  const bx = groupX + mi * barW;
                  const bh = (d[m.key] / maxVal) * chartH;
                  const by = chartH - bh;
                  return (
                    <rect
                      key={m.key} x={bx} y={by} width={barW - 2} height={bh}
                      fill={m.color} rx={2} opacity={0.9}
                      aria-label={`${m.label}: R$${d[m.key]}B`}
                    />
                  );
                })}
                <text x={groupX + barGroupW / 2} y={chartH + 16}
                  textAnchor="middle" fontSize={11} fill="#94a3b8">{d.year}</text>
              </g>
            );
          })}
        </g>
      </svg>
      <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
        {METRICS.filter(m => activeMetric === "all" || m.key === activeMetric).map(m => (
          <div key={m.key} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: m.color }}></div>
            <span style={{ fontSize: 11, color: "#64748b" }}>{m.label}</span>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
