"use client";

import React from "react";
import SectionCard from "./SectionCard";
import type { BankAnalysisResponse, BankFinancialRecord, BankIndicators } from "@/lib/banks/bank-types";

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

function IndicatorsGrid({ ind }: { ind: BankIndicators }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
      gap: 10,
    }}>
      <KpiCard label="ROE" value={pct(ind.roe)} description="Retorno sobre patrimônio" valueColor={pctColor(ind.roe)} />
      <KpiCard label="ROA" value={pct(ind.roa, 2)} description="Retorno sobre ativos" valueColor={pctColor(ind.roa)} />
      <KpiCard label="PL / Ativos" value={pct(ind.equityToAssets)} description="Índice de capitalização" />
      {ind.loanToAssets != null && (
        <KpiCard label="Crédito / Ativos" value={pct(ind.loanToAssets)} description="Concentração da carteira" />
      )}
      {ind.depositsToAssets != null && (
        <KpiCard label="Depósitos / Ativos" value={pct(ind.depositsToAssets)} description="Funding por depósitos" />
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

function AnnualTable({ records }: { records: BankFinancialRecord[] }) {
  const sorted = [...records].sort((a, b) => b.fiscalYear - a.fiscalYear);

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ background: "#f8fafc" }}>
            {["Ano", "Ativos Totais", "Patrimônio Líquido", "Lucro Líquido", "Carteira Crédito", "Depósitos"].map(h => (
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
              <td style={tdStyle}>{r.loanPortfolio != null ? brl(r.loanPortfolio) : "—"}</td>
              <td style={tdStyle}>{r.deposits != null ? brl(r.deposits) : "—"}</td>
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
  data: BankAnalysisResponse;
}

export default function BankAnalysisPanel({ data }: Props) {
  if (!data.available || data.annual.length === 0) {
    return (
      <SectionCard title="Análise Bancária" subtitle="Modelo específico para instituições financeiras">
        <div style={{ color: "#64748b", fontSize: 13, padding: "8px 0" }}>
          Este ativo exige modelo específico para instituições financeiras. O modelo bancário está sendo introduzido gradualmente.
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
      {data.indicators && (
        <SectionCard
          title="Indicadores Bancários"
          subtitle={`Baseado em ${latest.fiscalYear} · Fonte: CVM DFP`}
        >
          <IndicatorsGrid ind={data.indicators} />
        </SectionCard>
      )}

      <SectionCard
        title="Demonstrações Financeiras — Anuais"
        subtitle="Valores em bilhões de BRL · Fonte: CVM DFP"
      >
        <AnnualTable records={data.annual} />
      </SectionCard>
    </>
  );
}
