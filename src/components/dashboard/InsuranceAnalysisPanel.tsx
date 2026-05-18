"use client";

import React from "react";
import SectionCard from "./SectionCard";
import type { InsuranceAnalysisResponse, InsuranceFinancialRecord, InsuranceIndicators } from "@/lib/insurance/insurance-types";

// ── Formatters ─────────────────────────────────────────────────────────────────

function pct(v: number | null, decimals = 1): string {
  if (v === null) return "N/D";
  return `${(v * 100).toFixed(decimals).replace(".", ",")}%`;
}

function pctColor(v: number | null): string {
  if (v === null) return "#94a3b8";
  return v >= 0 ? "#16a34a" : "#dc2626";
}

function brl(v: number | null | undefined): string {
  if (v == null) return "N/D";
  return `R$ ${v.toFixed(1).replace(".", ",")}B`;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string;
  description: string;
  valueColor?: string;
}

function KpiCard({ label, value, description, valueColor = "#0f172a" }: KpiCardProps) {
  return (
    <div style={{
      background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8,
      padding: "12px 14px", display: "flex", flexDirection: "column", gap: 4,
    }}>
      <div style={{ fontSize: 11, color: "#64748b", fontWeight: 500 }}>{label}</div>
      <div style={{
        fontSize: 16, fontWeight: 700, color: valueColor,
        fontFamily: "'JetBrains Mono', monospace",
      }}>{value}</div>
      <div style={{ fontSize: 10, color: "#94a3b8" }}>{description}</div>
    </div>
  );
}

function IndicatorsGrid({ ind }: { ind: InsuranceIndicators }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
      gap: 10,
    }}>
      <KpiCard label="ROE" value={pct(ind.roe)} description="Retorno sobre patrimônio" valueColor={pctColor(ind.roe)} />
      <KpiCard label="ROA" value={pct(ind.roa, 2)} description="Retorno sobre ativos" valueColor={pctColor(ind.roa)} />
      <KpiCard label="PL / Ativos" value={pct(ind.equityToAssets)} description="Índice de capitalização" />
      {ind.claimsRatio != null && (
        <KpiCard label="Sinistros / Prêmios" value={pct(ind.claimsRatio)} description="Índice de sinistralidade" />
      )}
      <KpiCard
        label="Crescimento lucro"
        value={ind.netIncomeGrowthYoY != null ? pct(ind.netIncomeGrowthYoY) : "N/D"}
        description="Variação ano a ano"
        valueColor={pctColor(ind.netIncomeGrowthYoY)}
      />
      <KpiCard
        label="Crescimento ativos"
        value={ind.assetGrowthYoY != null ? pct(ind.assetGrowthYoY) : "N/D"}
        description="Variação ano a ano"
        valueColor={pctColor(ind.assetGrowthYoY)}
      />
    </div>
  );
}

function AnnualTable({ records }: { records: InsuranceFinancialRecord[] }) {
  const sorted = [...records].sort((a, b) => b.fiscalYear - a.fiscalYear);
  const hasPremiums = sorted.some(r => r.insurancePremiums != null);
  const hasClaims   = sorted.some(r => r.claimsExpense   != null);

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ background: "#f8fafc" }}>
            {[
              "Ano",
              "Ativos Totais",
              "Patrimônio Líquido",
              "Lucro Líquido",
              ...(hasPremiums ? ["Prêmios Ganhos"] : []),
              ...(hasClaims   ? ["Sinistros"]      : []),
            ].map(h => (
              <th key={h} style={{
                textAlign: "right", padding: "8px 10px", fontWeight: 600,
                color: "#374151", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap",
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map(r => (
            <tr key={r.fiscalYear} style={{ borderBottom: "1px solid #f1f5f9" }}>
              <td style={{ padding: "7px 10px", fontWeight: 600, color: "#0f172a", textAlign: "right" }}>{r.fiscalYear}</td>
              <td style={tdStyle}>{brl(r.totalAssets)}</td>
              <td style={tdStyle}>{brl(r.equity)}</td>
              <td style={tdStyle}>{brl(r.netIncome)}</td>
              {hasPremiums && <td style={tdStyle}>{r.insurancePremiums != null ? brl(r.insurancePremiums) : "—"}</td>}
              {hasClaims   && <td style={tdStyle}>{r.claimsExpense    != null ? brl(r.claimsExpense)    : "—"}</td>}
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
  data: InsuranceAnalysisResponse;
}

export default function InsuranceAnalysisPanel({ data }: Props) {
  if (!data.available || data.annual.length === 0) {
    return (
      <SectionCard title="Análise de Seguradora" subtitle="Modelo específico para seguradoras">
        <div style={{ color: "#64748b", fontSize: 13, padding: "8px 0" }}>
          Este ativo exige modelo específico para seguradoras. A estrutura de seguradoras não é comparável à de empresas industriais.
          {data.warnings.length > 0 && (
            <div style={{ marginTop: 6, color: "#94a3b8", fontSize: 11 }}>
              {data.warnings[0]}
            </div>
          )}
        </div>
      </SectionCard>
    );
  }

  const latest = [...data.annual].sort((a, b) => b.fiscalYear - a.fiscalYear)[0];

  return (
    <>
      {data.warnings.length > 0 && (
        <div style={{
          marginBottom: 12, padding: "9px 14px", background: "#fefce8",
          border: "1px solid #fde68a", borderRadius: 7,
          fontSize: 12, color: "#92400e",
        }}>
          Algumas contas de seguradoras podem não estar disponíveis de forma padronizada nos demonstrativos da CVM.
        </div>
      )}

      {data.indicators && (
        <SectionCard
          title="Indicadores de Seguradora"
          subtitle={`Baseado em ${latest.fiscalYear} · Fonte: CVM DFP`}
        >
          <IndicatorsGrid ind={data.indicators} />
        </SectionCard>
      )}

      <SectionCard
        title="Demonstrativos Anuais"
        subtitle="Valores em bilhões de BRL · Dados anuais CVM"
      >
        <AnnualTable records={data.annual} />
      </SectionCard>
    </>
  );
}
