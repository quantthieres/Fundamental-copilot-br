"use client";

import React, { useState, useEffect, useMemo } from "react";
import SectionCard from "./SectionCard";
import type {
  BaselineForecastCache,
  MetricForecastResult,
  ForecastMetric,
  ForecastPoint,
  ForecastQualityDiagnostic,
  ForecastReliabilityLevel,
} from "@/lib/forecasting/forecast-types";
import type {
  TickerTimeSeriesCache,
  FinancialTimeSeries,
} from "@/lib/forecasting/time-series-types";
import {
  fmtForecastValue,
  fmtAxisLabel,
  fmtBacktestPct,
  selectDefaultMetric,
} from "@/lib/forecasting/forecast-ui-utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const METRIC_OPTIONS: { key: ForecastMetric; label: string; shortLabel: string }[] = [
  { key: "revenue",            label: "Receita líquida",    shortLabel: "Receita"   },
  { key: "ebit",               label: "EBIT",               shortLabel: "EBIT"      },
  { key: "netIncome",          label: "Lucro líquido",      shortLabel: "Lucro liq."},
  { key: "operatingCashFlow",  label: "Fluxo de caixa op.", shortLabel: "FCO"       },
  { key: "freeCashFlow",       label: "Free cash flow",     shortLabel: "FCL"       },
  { key: "ebitMargin",         label: "Margem EBIT",        shortLabel: "M. EBIT"   },
  { key: "netMargin",          label: "Margem líquida",     shortLabel: "M. líq."   },
  { key: "freeCashFlowMargin", label: "Margem FCL",         shortLabel: "M. FCL"    },
];

const MODEL_LABELS: Record<string, string> = {
  naive:             "Naive (última observação)",
  seasonal_naive:    "Sazonalidade histórica",
  moving_average_4q: "Média móvel 4 trimestres",
  linear_trend:      "Tendência linear",
};

const HIST_LIMIT = 12;

// ─── Metric selector ──────────────────────────────────────────────────────────

function MetricSelector({
  selected,
  available,
  onSelect,
}: {
  selected: ForecastMetric;
  available: Set<ForecastMetric>;
  onSelect: (m: ForecastMetric) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
      {METRIC_OPTIONS.map(({ key, shortLabel }) => {
        const isActive = key === selected;
        const hasData  = available.has(key);
        return (
          <button
            key={key}
            onClick={() => onSelect(key)}
            style={{
              fontSize: 11, padding: "4px 10px", borderRadius: 6, cursor: "pointer",
              fontFamily: "inherit", transition: "background 0.12s, color 0.12s",
              opacity: hasData ? 1 : 0.5,
              ...(isActive
                ? { background: "#7c3aed", border: "1px solid #7c3aed", color: "#fff", fontWeight: 600 }
                : { border: "1px solid #e2e8f0", background: "#f8fafc", color: "#475569" }),
            }}
          >
            {shortLabel}
          </button>
        );
      })}
    </div>
  );
}

// ─── SVG line chart ───────────────────────────────────────────────────────────

function ForecastChart({
  historicalSeries,
  forecastResult,
}: {
  historicalSeries: FinancialTimeSeries | null;
  forecastResult: MetricForecastResult;
}) {
  const W = 580, H = 200;
  const PAD = { top: 16, right: 16, bottom: 30, left: 58 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;

  const histNonNull = useMemo(() => {
    if (!historicalSeries) return [];
    return historicalSeries.points
      .filter(p => p.value !== null)
      .slice(-HIST_LIMIT)
      .map(p => ({ period: p.period, value: p.value as number }));
  }, [historicalSeries]);

  const forecastPts = forecastResult.forecast.filter(p => p.yhat !== null);
  const unit = forecastResult.unit;

  const allPeriods: string[] = [
    ...histNonNull.map(p => p.period),
    ...forecastResult.forecast.map(p => p.period),
  ];
  const n = allPeriods.length;

  const allVals: number[] = [
    ...histNonNull.map(p => p.value),
    ...forecastPts.map(p => p.yhat as number),
    ...forecastPts.filter(p => p.yhatLower !== null).map(p => p.yhatLower as number),
    ...forecastPts.filter(p => p.yhatUpper !== null).map(p => p.yhatUpper as number),
  ];

  if (n === 0 || allVals.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "24px 0", fontSize: 12, color: "#94a3b8" }}>
        Sem dados suficientes para exibir o gráfico.
      </div>
    );
  }

  const rawMin = Math.min(...allVals);
  const rawMax = Math.max(...allVals);
  const range  = rawMax - rawMin || Math.abs(rawMax) || 1;
  const minV   = rawMin - range * 0.1;
  const maxV   = rawMax + range * 0.12;

  const xPos  = (i: number) => (i + 0.5) * (cW / n);
  const yPos  = (v: number) => cH * (1 - (v - minV) / (maxV - minV));
  const pidx  = new Map(allPeriods.map((p, i) => [p, i]));

  const zeroY = yPos(0);
  const showZeroLine = minV < 0 && maxV > 0;

  const histBoundaryIdx = histNonNull.length - 1;
  const histBoundaryX   = histNonNull.length > 0 ? xPos(histBoundaryIdx) : null;

  // Y-axis ticks
  const yTicks = Array.from({ length: 5 }, (_, i) => minV + (maxV - minV) * (i / 4));

  // Historical path
  const histPath = histNonNull.length > 0
    ? histNonNull
        .map((p, i) => `${i === 0 ? "M" : "L"} ${xPos(i).toFixed(1)} ${yPos(p.value).toFixed(1)}`)
        .join(" ")
    : null;

  // Forecast path (starts from last hist point for visual continuity)
  const fcastLineSegs: string[] = [];
  if (histNonNull.length > 0) {
    const lh = histNonNull[histNonNull.length - 1];
    fcastLineSegs.push(`M ${xPos(histBoundaryIdx).toFixed(1)} ${yPos(lh.value).toFixed(1)}`);
  }
  forecastResult.forecast.forEach(p => {
    if (p.yhat === null) return;
    const idx = pidx.get(p.period);
    if (idx === undefined) return;
    fcastLineSegs.push(`L ${xPos(idx).toFixed(1)} ${yPos(p.yhat).toFixed(1)}`);
  });
  const fcastPath = fcastLineSegs.length > (histNonNull.length > 0 ? 1 : 0) ? fcastLineSegs.join(" ") : null;

  // Uncertainty band
  const withBand = forecastResult.forecast.filter(
    p => p.yhat !== null && p.yhatLower !== null && p.yhatUpper !== null,
  );
  let bandPath: string | null = null;
  if (withBand.length > 0) {
    const upper = withBand.map(p => `${xPos(pidx.get(p.period)!).toFixed(1)},${yPos(p.yhatUpper!).toFixed(1)}`);
    const lower = [...withBand].reverse().map(p => `${xPos(pidx.get(p.period)!).toFixed(1)},${yPos(p.yhatLower!).toFixed(1)}`);
    const anchor = histNonNull.length > 0
      ? `M ${xPos(histBoundaryIdx).toFixed(1)},${yPos(histNonNull[histBoundaryIdx].value).toFixed(1)} L `
      : "M ";
    bandPath = `${anchor}${upper.join(" L ")} L ${lower.join(" L ")} Z`;
  }

  const labelStep = n > 18 ? 3 : n > 12 ? 2 : 1;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ overflow: "visible" }}>
        <g transform={`translate(${PAD.left},${PAD.top})`}>
          {yTicks.map((v, i) => (
            <g key={i}>
              <line x1={0} y1={yPos(v)} x2={cW} y2={yPos(v)} stroke="#f1f5f9" strokeWidth={1} />
              <text
                x={-6} y={yPos(v) + 4} textAnchor="end" fontSize={9}
                fill="#94a3b8" fontFamily="JetBrains Mono, monospace"
              >
                {fmtAxisLabel(v, unit)}
              </text>
            </g>
          ))}

          {showZeroLine && (
            <line x1={0} y1={zeroY} x2={cW} y2={zeroY} stroke="#e2e8f0" strokeWidth={1} strokeDasharray="4,3" />
          )}

          {histBoundaryX !== null && (
            <line
              x1={histBoundaryX} y1={0} x2={histBoundaryX} y2={cH}
              stroke="#c4b5fd" strokeWidth={1} strokeDasharray="5,3"
            />
          )}

          {bandPath && (
            <path d={bandPath} fill="#ede9fe" opacity={0.55} stroke="none" />
          )}

          {histPath && (
            <path d={histPath} fill="none" stroke="#2563eb" strokeWidth={2}
              strokeLinejoin="round" strokeLinecap="round" />
          )}

          {fcastPath && (
            <path d={fcastPath} fill="none" stroke="#7c3aed" strokeWidth={2}
              strokeLinejoin="round" strokeLinecap="round" strokeDasharray="7,3" />
          )}

          {histNonNull.map((p, i) => (
            <circle key={p.period} cx={xPos(i)} cy={yPos(p.value)} r={2.5} fill="#2563eb" />
          ))}

          {forecastResult.forecast.map(p => {
            if (p.yhat === null) return null;
            const idx = pidx.get(p.period);
            if (idx === undefined) return null;
            return (
              <circle
                key={p.period} cx={xPos(idx)} cy={yPos(p.yhat)} r={3}
                fill="#7c3aed" stroke="#fff" strokeWidth={1}
              />
            );
          })}

          {allPeriods.map((period, i) => {
            if (i % labelStep !== 0) return null;
            return (
              <text
                key={period} x={xPos(i)} y={cH + 18} textAnchor="middle"
                fontSize={9} fill="#94a3b8" fontFamily="JetBrains Mono, monospace"
              >
                {period}
              </text>
            );
          })}
        </g>
      </svg>

      <div style={{ display: "flex", gap: 16, marginTop: 6, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 20, height: 2, background: "#2563eb", borderRadius: 1 }} />
          <span style={{ fontSize: 11, color: "#64748b" }}>Histórico</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{
            width: 20, height: 2, background: "#7c3aed", borderRadius: 1,
            backgroundImage: "repeating-linear-gradient(90deg,#7c3aed 0,#7c3aed 7px,transparent 7px,transparent 10px)",
            backgroundSize: "10px 2px",
          }} />
          <span style={{ fontSize: 11, color: "#64748b" }}>Projeção</span>
        </div>
        {bandPath && (
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 12, height: 12, background: "#ede9fe", border: "1px solid #c4b5fd", borderRadius: 2 }} />
            <span style={{ fontSize: 11, color: "#64748b" }}>Banda de incerteza</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Forecast table ───────────────────────────────────────────────────────────

function ForecastTable({ forecastResult }: { forecastResult: MetricForecastResult }) {
  const { unit, forecast } = forecastResult;
  const hasBand = forecast.some(p => p.yhatLower !== null || p.yhatUpper !== null);

  return (
    <div style={{ overflowX: "auto", marginTop: 16 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
            {["Período", "Projeção", ...(hasBand ? ["Limite inferior", "Limite superior"] : [])].map(h => (
              <th key={h} style={{
                textAlign: "left", padding: "5px 8px",
                fontSize: 11, color: "#94a3b8", fontWeight: 500,
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {forecast.map((p, i) => (
            <tr
              key={p.period}
              style={{ borderBottom: i < forecast.length - 1 ? "1px solid #f1f5f9" : "none" }}
            >
              <td style={{
                padding: "5px 8px", fontFamily: "'JetBrains Mono', monospace",
                fontSize: 12, color: "#0f172a",
              }}>
                {p.period}
              </td>
              <td style={{
                padding: "5px 8px", fontFamily: "'JetBrains Mono', monospace",
                fontSize: 12, color: "#7c3aed", fontWeight: 600,
              }}>
                {fmtForecastValue(p.yhat, unit)}
              </td>
              {hasBand && (
                <>
                  <td style={{ padding: "5px 8px", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#94a3b8" }}>
                    {fmtForecastValue(p.yhatLower, unit)}
                  </td>
                  <td style={{ padding: "5px 8px", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#94a3b8" }}>
                    {fmtForecastValue(p.yhatUpper, unit)}
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Backtest summary ─────────────────────────────────────────────────────────

function BacktestSummary({ forecastResult }: { forecastResult: MetricForecastResult }) {
  const selected = forecastResult.backtest.find(b => b.model === forecastResult.modelSelected);
  if (!selected) return null;
  const m = selected.metrics;

  const items = [
    { label: "WAPE",  value: fmtBacktestPct(m.wape),  tip: "Erro percentual ponderado" },
    { label: "sMAPE", value: fmtBacktestPct(m.smape), tip: "Erro percentual simétrico" },
    { label: "MAE",   value: m.mae  !== null ? m.mae.toFixed(3).replace(".", ",")  : "—", tip: "Erro absoluto médio" },
    { label: "RMSE",  value: m.rmse !== null ? m.rmse.toFixed(3).replace(".", ",") : "—", tip: "Raiz do erro quadrático" },
  ];

  return (
    <div style={{
      marginTop: 14, padding: "10px 14px",
      background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8,
    }}>
      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 10, lineHeight: 1.5 }}>
        Erro observado no retroteste walk-forward · {m.testObservations} período{m.testObservations !== 1 ? "s" : ""} de teste
      </div>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        {items.map(({ label, value, tip }) => (
          <div key={label} title={tip}>
            <div style={{
              fontSize: 10, color: "#94a3b8", fontWeight: 600,
              textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2,
            }}>
              {label}
            </div>
            <div style={{
              fontSize: 14, color: "#0f172a", fontWeight: 700,
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              {value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Model info strip ─────────────────────────────────────────────────────────

function ModelInfoStrip({ forecastResult }: { forecastResult: MetricForecastResult }) {
  const { modelSelected, lastObservedPeriod, observations } = forecastResult;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
      <div style={{
        fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 20,
        background: "#ede9fe", color: "#7c3aed", letterSpacing: "0.3px",
      }}>
        {modelSelected ? MODEL_LABELS[modelSelected] : "Sem modelo"}
      </div>
      {lastObservedPeriod && (
        <span style={{ fontSize: 11, color: "#94a3b8" }}>
          Último observado: <strong style={{ color: "#475569", fontFamily: "'JetBrains Mono', monospace" }}>{lastObservedPeriod}</strong>
        </span>
      )}
      <span style={{ fontSize: 11, color: "#94a3b8" }}>
        {observations} observações
      </span>
    </div>
  );
}

// ─── Warnings ─────────────────────────────────────────────────────────────────

function WarningList({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null;
  return (
    <div style={{ marginTop: 12 }}>
      {warnings.map((w, i) => (
        <div
          key={i}
          style={{
            fontSize: 11, color: "#92400e", lineHeight: 1.5,
            padding: "5px 10px", background: "#fffbeb",
            border: "1px solid #fde68a", borderRadius: 6, marginBottom: 4,
          }}
        >
          {w}
        </div>
      ))}
    </div>
  );
}

// ─── Quality badge ────────────────────────────────────────────────────────────

const QUALITY_CONFIG: Record<ForecastReliabilityLevel, { label: string; bg: string; color: string; border: string }> = {
  high:         { label: "Alta confiabilidade",   bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0" },
  medium:       { label: "Confiabilidade média",  bg: "#fefce8", color: "#a16207", border: "#fde047" },
  low:          { label: "Baixa confiabilidade",  bg: "#fff1f2", color: "#be123c", border: "#fecdd3" },
  insufficient: { label: "Dados insuficientes",   bg: "#f8fafc", color: "#64748b", border: "#e2e8f0" },
};

function ForecastQualityCard({ quality }: { quality: ForecastQualityDiagnostic }) {
  const cfg = QUALITY_CONFIG[quality.level];
  const allReasons = quality.reasons;
  const allWarnings = quality.warnings;

  return (
    <div style={{
      marginTop: 12, padding: "10px 14px",
      background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: allReasons.length > 0 || allWarnings.length > 0 ? 8 : 0 }}>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
          background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
          letterSpacing: "0.2px",
        }}>
          {cfg.label}
        </span>
        <span style={{
          fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
          color: "#475569", fontWeight: 600,
        }}>
          {quality.score}/100
        </span>
        <span style={{ fontSize: 10, color: "#94a3b8", marginLeft: "auto" }}>
          Diagnóstico de confiabilidade
        </span>
      </div>

      {allReasons.length > 0 && (
        <ul style={{ margin: 0, padding: "0 0 0 14px", listStyle: "disc" }}>
          {allReasons.map((r, i) => (
            <li key={i} style={{ fontSize: 11, color: "#475569", lineHeight: 1.5, marginBottom: 2 }}>{r}</li>
          ))}
        </ul>
      )}

      {allWarnings.length > 0 && (
        <div style={{ marginTop: allReasons.length > 0 ? 6 : 0 }}>
          {allWarnings.map((w, i) => (
            <div key={i} style={{
              fontSize: 11, color: "#92400e", padding: "4px 8px",
              background: "#fffbeb", border: "1px solid #fde68a",
              borderRadius: 5, marginBottom: 3, lineHeight: 1.4,
            }}>
              {w}
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 8, fontSize: 10, color: "#94a3b8", lineHeight: 1.4 }}>
        Este diagnóstico avalia a estabilidade histórica e o erro observado no retroteste. Ele não representa recomendação de investimento.
      </div>
    </div>
  );
}

// ─── Loading / error / unavailable states ─────────────────────────────────────

function LoadingState() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "32px 0", justifyContent: "center" }}>
      <div style={{
        width: 14, height: 14, borderRadius: "50%",
        border: "2px solid #e2e8f0", borderTopColor: "#7c3aed",
        animation: "spin 0.7s linear infinite",
      }} />
      <span style={{ fontSize: 13, color: "#94a3b8" }}>Carregando projeções...</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function UnavailableState() {
  return (
    <div style={{
      padding: "24px 16px", background: "#f8fafc",
      border: "1px solid #e2e8f0", borderRadius: 8, textAlign: "center",
    }}>
      <div style={{ fontSize: 13, color: "#475569", fontWeight: 500, marginBottom: 4 }}>
        Projeções de fundamentos ainda não disponíveis para este ativo.
      </div>
      <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
        As projeções são geradas periodicamente a partir dos dados CVM. Alguns ativos podem não ter dados suficientes para os modelos baseline.
      </div>
    </div>
  );
}

function NoForecastForMetric() {
  return (
    <div style={{
      padding: "18px 14px", background: "#f8fafc",
      border: "1px solid #e2e8f0", borderRadius: 8, textAlign: "center",
    }}>
      <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
        Dados insuficientes para gerar projeções nesta métrica.
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type PanelState = "loading" | "done" | "error" | "unavailable";

export default function ForecastPanel({ ticker }: { ticker: string }) {
  const [panelState, setPanelState]     = useState<PanelState>("loading");
  const [forecastData, setForecastData] = useState<BaselineForecastCache | null>(null);
  const [tsData, setTsData]             = useState<TickerTimeSeriesCache | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<ForecastMetric>("revenue");

  // Fetch both endpoints in parallel.
  useEffect(() => {
    if (!ticker) return;
    const controller = new AbortController();
    let active = true;

    setPanelState("loading");
    setForecastData(null);
    setTsData(null);

    const baselineReq = fetch(`/api/forecasting/baseline/${encodeURIComponent(ticker)}`, { signal: controller.signal })
      .then(res => res.ok ? res.json() : Promise.reject(res.status));

    const tsReq = fetch(`/api/forecasting/time-series/${encodeURIComponent(ticker)}`, { signal: controller.signal })
      .then(res => res.ok ? res.json() : null)
      .catch(() => null);

    Promise.all([baselineReq, tsReq])
      .then(([baseline, ts]: [BaselineForecastCache, TickerTimeSeriesCache | null]) => {
        if (!active) return;
        setForecastData(baseline);
        setTsData(ts);
        const def = selectDefaultMetric(baseline.forecasts);
        if (def) setSelectedMetric(def);
        setPanelState("done");
      })
      .catch((err) => {
        if (!active) return;
        // 404 = no forecast cache for this ticker → unavailable state
        setPanelState(err === 404 ? "unavailable" : "error");
      });

    return () => { active = false; controller.abort(); };
  }, [ticker]);

  // Index of available metrics (those with at least one forecast point).
  const availableMetrics = useMemo((): Set<ForecastMetric> => {
    if (!forecastData) return new Set();
    return new Set(
      forecastData.forecasts
        .filter(f => f.modelSelected !== null)
        .map(f => f.metric),
    );
  }, [forecastData]);

  // The selected metric's forecast result and corresponding historical series.
  const activeResult: MetricForecastResult | null = useMemo(() => {
    if (!forecastData) return null;
    return forecastData.forecasts.find(f => f.metric === selectedMetric) ?? null;
  }, [forecastData, selectedMetric]);

  const activeSeries: FinancialTimeSeries | null = useMemo(() => {
    if (!tsData) return null;
    return tsData.series.find(s => s.metric === selectedMetric) ?? null;
  }, [tsData, selectedMetric]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <SectionCard
      title="Projeções de fundamentos"
      subtitle="Modelos baseline baseados em séries históricas CVM. As projeções são quantitativas e não representam recomendação de investimento."
    >
      {panelState === "loading" && <LoadingState />}

      {panelState === "error" && (
        <div style={{
          background: "#fef3c7", border: "1px solid #fde68a",
          borderRadius: 8, padding: "12px 16px", fontSize: 12, color: "#92400e",
        }}>
          Não foi possível carregar as projeções. Tente novamente mais tarde.
        </div>
      )}

      {panelState === "unavailable" && <UnavailableState />}

      {panelState === "done" && forecastData && (
        <>
          <MetricSelector
            selected={selectedMetric}
            available={availableMetrics}
            onSelect={setSelectedMetric}
          />

          {activeResult ? (
            <>
              <ModelInfoStrip forecastResult={activeResult} />

              {activeResult.modelSelected === null || activeResult.forecast.length === 0 ? (
                <>
                  <NoForecastForMetric />
                  {activeResult.quality && (
                    <ForecastQualityCard quality={activeResult.quality} />
                  )}
                </>
              ) : (
                <>
                  <ForecastChart historicalSeries={activeSeries} forecastResult={activeResult} />
                  <ForecastTable forecastResult={activeResult} />
                  <BacktestSummary forecastResult={activeResult} />
                  {activeResult.quality && (
                    <ForecastQualityCard quality={activeResult.quality} />
                  )}
                </>
              )}

              <WarningList warnings={activeResult.warnings} />
            </>
          ) : (
            <NoForecastForMetric />
          )}

          {/* Global warnings from the cache */}
          {forecastData.warnings.length > 0 && (
            <div style={{ marginTop: 10, fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>
              {forecastData.warnings.map((w, i) => (
                <div key={i}>{w}</div>
              ))}
            </div>
          )}

          <div style={{
            marginTop: 14, paddingTop: 10, borderTop: "1px solid #f1f5f9",
            fontSize: 10, color: "#94a3b8", lineHeight: 1.5,
          }}>
            Projeções geradas em {new Date(forecastData.generatedAt).toLocaleDateString("pt-BR")} ·
            {" "}Fonte: CVM ITR/DFP Dados Abertos ·{" "}
            Horizonte: {forecastData.horizonQuarters} trimestres ·{" "}
            Não constitui recomendação de investimento, preço-alvo ou análise de valor.
          </div>
        </>
      )}
    </SectionCard>
  );
}
