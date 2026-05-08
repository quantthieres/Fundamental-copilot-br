import React from "react";
import SectionCard from "./SectionCard";
import type { NormalizedFinancials } from "@/lib/cvm/types";
import type { MarketDataQuote } from "@/lib/market-data/types";
import { buildFundamentalIndicators } from "@/lib/fundamentals/indicators";

interface Props {
  financials: NormalizedFinancials[];
  marketQuote: MarketDataQuote | null;
}

function pct(v: number | null, decimals = 1): string {
  if (v === null) return "N/D";
  return `${(v * 100).toFixed(decimals).replace(".", ",")}%`;
}

function multi(v: number | null, decimals = 1): string {
  if (v === null) return "N/D";
  return `${v.toFixed(decimals).replace(".", ",")}x`;
}

function brl(v: number | null): string {
  if (v === null) return "N/D";
  return `R$ ${v.toFixed(1).replace(".", ",")}B`;
}

function growth(v: number | null): string {
  if (v === null) return "N/D";
  const s = (v * 100).toFixed(1).replace(".", ",");
  return v >= 0 ? `+${s}%` : `${s}%`;
}

function growthColor(v: number | null): string {
  if (v === null) return "#94a3b8";
  return v >= 0 ? "#16a34a" : "#dc2626";
}

interface IndicatorRowProps {
  label: string;
  value: string;
  description: string;
  valueColor?: string;
}

function IndicatorRow({ label, value, description, valueColor = "#0f172a" }: IndicatorRowProps) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "1fr auto",
      gap: "4px 16px", padding: "9px 0",
      borderBottom: "1px solid #f1f5f9", alignItems: "center",
    }}>
      <div>
        <div style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>{description}</div>
      </div>
      <div style={{
        fontSize: 13, fontWeight: 700, color: valueColor,
        fontFamily: "'JetBrains Mono', monospace", textAlign: "right", whiteSpace: "nowrap",
      }}>
        {value}
      </div>
    </div>
  );
}

function GroupHeader({ title }: { title: string }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, letterSpacing: "0.7px",
      textTransform: "uppercase" as const, color: "#94a3b8",
      padding: "14px 0 4px", borderBottom: "1px solid #e2e8f0",
      marginBottom: 2,
    }}>
      {title}
    </div>
  );
}

export default function FundamentalIndicators({ financials, marketQuote }: Props) {
  if (!financials || financials.length === 0) {
    return (
      <SectionCard title="Indicadores Fundamentalistas" subtitle="Calculados com dados CVM e cotação brapi">
        <div style={{ padding: "24px 0", textAlign: "center", fontSize: 13, color: "#94a3b8" }}>
          Dados financeiros CVM não disponíveis para este ativo.
        </div>
      </SectionCard>
    );
  }

  const ind = buildFundamentalIndicators(financials, marketQuote);

  return (
    <SectionCard title="Indicadores Fundamentalistas" subtitle="Calculados com dados CVM e cotação brapi">

      <GroupHeader title="Crescimento" />
      <IndicatorRow
        label="Crescimento de Receita (a/a)"
        value={growth(ind.growth.revenueGrowthYoY)}
        description="Variação da receita no último ano fiscal disponível."
        valueColor={growthColor(ind.growth.revenueGrowthYoY)}
      />
      <IndicatorRow
        label="CAGR Receita"
        value={pct(ind.growth.revenueCAGR)}
        description="Taxa de crescimento anual composto da receita (período disponível)."
        valueColor={growthColor(ind.growth.revenueCAGR)}
      />
      <IndicatorRow
        label="Crescimento EBIT (a/a)"
        value={growth(ind.growth.ebitGrowthYoY)}
        description="Variação do EBIT no último ano fiscal disponível."
        valueColor={growthColor(ind.growth.ebitGrowthYoY)}
      />
      <IndicatorRow
        label="Crescimento Lucro Líquido (a/a)"
        value={growth(ind.growth.netIncomeGrowthYoY)}
        description="Variação do lucro líquido no último ano fiscal disponível."
        valueColor={growthColor(ind.growth.netIncomeGrowthYoY)}
      />

      <GroupHeader title="Margens" />
      <IndicatorRow
        label="Margem EBIT"
        value={pct(ind.margins.ebitMargin)}
        description="EBIT / Receita líquida."
      />
      <IndicatorRow
        label="Margem Líquida"
        value={pct(ind.margins.netMargin)}
        description="Lucro líquido / Receita líquida."
      />
      <IndicatorRow
        label="Margem CFO"
        value={pct(ind.margins.cfoMargin)}
        description="Fluxo de caixa operacional / Receita líquida."
      />
      <IndicatorRow
        label="Margem FCF"
        value={pct(ind.margins.fcfMargin)}
        description="Fluxo de caixa livre / Receita líquida."
      />

      <GroupHeader title="Geração de Caixa" />
      <IndicatorRow
        label="CFO / Lucro Líquido"
        value={multi(ind.cashConversion.cfoOverNetIncome)}
        description="Caixa gerado pelas operações em relação ao lucro contábil."
      />
      <IndicatorRow
        label="FCF / Lucro Líquido"
        value={multi(ind.cashConversion.fcfOverNetIncome)}
        description="Conversão do lucro líquido em fluxo de caixa livre."
      />
      <IndicatorRow
        label="Capex / Receita"
        value={pct(ind.cashConversion.capexOverRevenue)}
        description="Intensidade de capital em relação à receita."
      />
      <IndicatorRow
        label="FCF Yield"
        value={pct(ind.cashConversion.fcfYield)}
        description="Fluxo de caixa livre / valor de mercado."
      />

      <GroupHeader title="Endividamento" />
      <IndicatorRow
        label="Dívida Líquida"
        value={brl(ind.debt.netDebt)}
        description="Dívida bruta menos caixa e equivalentes (R$ bilhões)."
      />
      <IndicatorRow
        label="Dívida Líquida / EBIT"
        value={multi(ind.debt.netDebtOverEbit)}
        description="Anos de EBIT necessários para quitar a dívida líquida."
      />
      <IndicatorRow
        label="Dívida Líquida / FCF"
        value={multi(ind.debt.netDebtOverFcf)}
        description="Anos de FCF necessários para quitar a dívida líquida."
      />

      <GroupHeader title="Mercado" />
      <IndicatorRow
        label="Valor de Mercado"
        value={brl(ind.market.marketCapB)}
        description="Market cap em R$ bilhões (fonte: brapi)."
      />
      <IndicatorRow
        label="Enterprise Value"
        value={brl(ind.market.enterpriseValueB)}
        description="Market cap + dívida líquida (estimado)."
      />
      <IndicatorRow
        label="P/L"
        value={multi(ind.market.pe)}
        description="Preço / Lucro líquido por ação."
      />
      <IndicatorRow
        label="EV/EBIT"
        value={multi(ind.market.evOverEbit)}
        description="Enterprise Value / EBIT."
      />
      <IndicatorRow
        label="EV/Receita"
        value={multi(ind.market.evOverRevenue)}
        description="Enterprise Value / Receita líquida."
      />

      <div style={{ marginTop: 14, fontSize: 11, color: "#94a3b8", lineHeight: 1.6 }}>
        Indicadores calculados com dados da DFP anual consolidada (CVM) e cotação via brapi.
        N/D = dado não disponível ou denominador zero. Não constitui recomendação de investimento.
      </div>
    </SectionCard>
  );
}
