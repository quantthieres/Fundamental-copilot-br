"use client";

import React from "react";
import SectionCard from "./SectionCard";
import type { FiiAnalysisResponse, FiiFinancialRecord } from "@/lib/fiis/fii-types";
import { computeFiiIndicators } from "@/lib/fiis/fii-indicators";
import type { FiiIndicators } from "@/lib/fiis/fii-types";

// ── Formatters ─────────────────────────────────────────────────────────────────

function pct(v: number | null, decimals = 1): string {
  if (v === null) return "N/D";
  return `${(v * 100).toFixed(decimals).replace(".", ",")}%`;
}

function brl(v: number | null | undefined): string {
  if (v == null) return "N/D";
  return `R$ ${v.toFixed(2).replace(".", ",")}`;
}

function brlB(v: number | null | undefined): string {
  if (v == null) return "N/D";
  return `R$ ${v.toFixed(1).replace(".", ",")}B`;
}

function fmtQuota(v: number | null | undefined): string {
  if (v == null) return "N/D";
  return v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

function fmtDate(d: string): string {
  // YYYY-MM-DD → MM/YYYY
  const parts = d.split("-");
  if (parts.length >= 2) return `${parts[1]}/${parts[0]}`;
  return d;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string;
  description: string;
}

function KpiCard({ label, value, description }: KpiCardProps) {
  return (
    <div style={{
      background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8,
      padding: "12px 14px", display: "flex", flexDirection: "column", gap: 4,
    }}>
      <div style={{ fontSize: 11, color: "#64748b", fontWeight: 500 }}>{label}</div>
      <div style={{
        fontSize: 16, fontWeight: 700, color: "#0f172a",
        fontFamily: "'JetBrains Mono', monospace",
      }}>{value}</div>
      <div style={{ fontSize: 10, color: "#94a3b8" }}>{description}</div>
    </div>
  );
}

function IndicatorsGrid({ ind }: { ind: FiiIndicators }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
      gap: 10,
    }}>
      <KpiCard
        label="Valor Patrimonial / Cota"
        value={brl(ind.netAssetValuePerShare)}
        description="Último valor patrimonial por cota"
      />
      <KpiCard
        label="Último Rendimento / Cota"
        value={brl(ind.lastDistributionPerShare)}
        description="Rendimento do último mês disponível"
      />
      <KpiCard
        label="Rendimentos 12m / Cota"
        value={brl(ind.twelveMonthDistributionPerShare)}
        description="Soma dos últimos 12 meses disponíveis"
      />
      <KpiCard
        label="DY 12m"
        value={ind.dividendYield12m !== null ? pct(ind.dividendYield12m) : "N/D"}
        description="Rendimentos 12m / preço de mercado"
      />
      <KpiCard
        label="P / Valor Patrimonial"
        value={ind.priceToBookValuePerShare !== null
          ? ind.priceToBookValuePerShare.toFixed(2).replace(".", ",") + "×"
          : "N/D"}
        description="Preço de mercado / valor patrimonial por cota"
      />
    </div>
  );
}

function MonthlyTable({ records }: { records: FiiFinancialRecord[] }) {
  const sorted = [...records].sort((a, b) =>
    a.referenceDate < b.referenceDate ? 1 : a.referenceDate > b.referenceDate ? -1 : 0,
  );

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ background: "#f8fafc" }}>
            {["Mês/Ano", "Patrimônio Líquido", "Nº de Cotas", "VP / Cota", "Rendimento / Cota"].map(h => (
              <th key={h} style={{
                textAlign: "right", padding: "8px 10px", fontWeight: 600,
                color: "#374151", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap",
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map(r => (
            <tr key={r.referenceDate} style={{ borderBottom: "1px solid #f1f5f9" }}>
              <td style={{ padding: "7px 10px", fontWeight: 600, color: "#0f172a", textAlign: "right" }}>
                {fmtDate(r.referenceDate)}
              </td>
              <td style={tdStyle}>{brlB(r.netAssetValue)}</td>
              <td style={tdStyle}>{fmtQuota(r.quotaCount)}</td>
              <td style={tdStyle}>{brl(r.netAssetValuePerShare)}</td>
              <td style={tdStyle}>{(r.monthlyDistributionPerShare != null && r.monthlyDistributionPerShare > 0) ? brl(r.monthlyDistributionPerShare) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const tdStyle: React.CSSProperties = {
  padding: "7px 10px", textAlign: "right", color: "#374151",
  fontFamily: "'JetBrains Mono', monospace",
};

// ── Public component ───────────────────────────────────────────────────────────

interface Props {
  data: FiiAnalysisResponse;
  marketPrice: number | null;
}

export default function FiiAnalysisPanel({ data, marketPrice }: Props) {
  if (!data.available || data.records.length === 0) {
    return (
      <SectionCard title="Análise de FII" subtitle="Modelo específico para fundos imobiliários">
        <div style={{ color: "#64748b", fontSize: 13, padding: "8px 0" }}>
          Este ativo exige modelo específico para fundos imobiliários. A estrutura de FIIs não é comparável à de empresas industriais.
          {data.warnings.length > 0 && (
            <div style={{ marginTop: 6, color: "#94a3b8", fontSize: 11 }}>
              {data.warnings[0]}
            </div>
          )}
        </div>
      </SectionCard>
    );
  }

  const indicators = computeFiiIndicators(data.records, marketPrice);
  const sorted     = [...data.records].sort((a, b) =>
    a.referenceDate < b.referenceDate ? 1 : -1,
  );
  const latestDate = sorted[0]?.referenceDate ?? "";

  return (
    <>
      {data.warnings.length > 0 && (
        <div style={{
          marginBottom: 12, padding: "9px 14px", background: "#fefce8",
          border: "1px solid #fde68a", borderRadius: 7,
          fontSize: 12, color: "#92400e",
        }}>
          Alguns dados de FIIs podem não estar disponíveis de forma padronizada nesta primeira versão.
        </div>
      )}

      {indicators && (
        <SectionCard
          title="Indicadores de FII"
          subtitle={`Último período: ${fmtDate(latestDate)} · Fonte: CVM Informe Mensal`}
        >
          {indicators.distributionCoverageMonths < 6 && (
            <div style={{
              marginBottom: 10, padding: "8px 12px", background: "#f8fafc",
              border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 12, color: "#64748b",
            }}>
              Dados de rendimentos ainda não estão disponíveis de forma padronizada para este FII.
            </div>
          )}
          {indicators.distributionCoverageMonths >= 6 && indicators.distributionCoverageMonths < 12 && (
            <div style={{
              marginBottom: 10, padding: "8px 12px", background: "#fefce8",
              border: "1px solid #fde68a", borderRadius: 6, fontSize: 12, color: "#92400e",
            }}>
              Série de rendimentos incompleta: {indicators.distributionCoverageMonths} de 12 meses disponíveis. DY 12m pode estar subestimado.
            </div>
          )}
          <IndicatorsGrid ind={indicators} />
        </SectionCard>
      )}

      <SectionCard
        title="Patrimônio e Rendimentos — Mensais"
        subtitle="Fonte: CVM Informe Mensal"
      >
        <MonthlyTable records={data.records} />
      </SectionCard>
    </>
  );
}
