import React from "react";
import { B3_UNIVERSE } from "@/data/b3-universe";
import { resolveModelRoute } from "@/lib/coverage/model-routing";
import { readBankCache } from "@/lib/banks/bank-cache";
import { readFiiCache } from "@/lib/fiis/fii-cache";
import { readInsuranceCache } from "@/lib/insurance/insurance-cache";
import { getInstrumentInfo } from "@/lib/instruments/instrument-info";
import { getBrapiQuote } from "@/lib/market-data/brapi";
import ReportPageClient from "./ReportPageClient";
import ReportShell from "@/components/report/ReportShell";
import ReportSection from "@/components/report/ReportSection";
import ReportMetricGrid from "@/components/report/ReportMetricGrid";
import type { BankAnalysisResponse, BankFinancialRecord } from "@/lib/banks/bank-types";
import type { FiiAnalysisResponse } from "@/lib/fiis/fii-types";
import type { InsuranceAnalysisResponse, InsuranceFinancialRecord } from "@/lib/insurance/insurance-types";
import type { MarketDataQuote } from "@/lib/market-data/types";

export const dynamic = "force-dynamic";

interface Props {
  params:       Promise<{ ticker: string }>;
  searchParams: Promise<{ source?: string }>;
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

const MONO = "'JetBrains Mono', 'Courier New', monospace";

function fmtBRL(v: number | null | undefined): string {
  if (v == null || v === 0) return "—";
  const abs = Math.abs(v);
  return (v < 0 ? "−R$ " : "R$ ") + abs.toFixed(1).replace(".", ",") + "B";
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return "—";
  return v.toFixed(1).replace(".", ",") + "%";
}

function fmtPrice(v: number | null | undefined): string {
  if (v == null || v === 0) return "—";
  return "R$ " + v.toFixed(2).replace(".", ",");
}

function fmtBRLPerShare(v: number | null | undefined): string {
  if (v == null || v === 0) return "—";
  return "R$ " + v.toFixed(2).replace(".", ",");
}

// ─── Quote block (shared) ─────────────────────────────────────────────────────

function QuoteBlock({ quote }: { quote: MarketDataQuote | null }) {
  if (!quote || !quote.price || quote.price === 0) return null;
  return (
    <div style={{
      display: "flex", gap: 24, padding: "14px 18px",
      background: "#f8fafc", borderRadius: 8, marginBottom: 20,
      border: "1px solid #e2e8f0", flexWrap: "wrap",
    }}>
      <div>
        <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>Cotação</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", fontFamily: MONO }}>
          {fmtPrice(quote.price)}
        </div>
      </div>
      {quote.changePercent != null && (
        <div>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>Variação</div>
          <div style={{
            fontSize: 15, fontWeight: 600, fontFamily: MONO,
            color: quote.changePercent >= 0 ? "#16a34a" : "#dc2626",
          }}>
            {quote.changePercent >= 0 ? "+" : ""}{quote.changePercent.toFixed(2).replace(".", ",")}%
          </div>
        </div>
      )}
      {quote.marketCap != null && quote.marketCap > 0 && (
        <div>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>Market Cap</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#0f172a", fontFamily: MONO }}>
            {fmtBRL(quote.marketCap / 1e9)}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Annual table (bank / insurance) ─────────────────────────────────────────

function AnnualTable({
  rows,
  columns,
}: {
  rows: Array<Record<string, number | string | null | undefined>>;
  columns: Array<{ key: string; label: string }>;
}) {
  const sorted = [...rows].sort((a, b) => Number(a.fiscalYear) - Number(b.fiscalYear));
  return (
    <div className="report-table-wrap" style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, fontFamily: MONO }}>
        <thead>
          <tr style={{ background: "#f8fafc" }}>
            {columns.map((c, i) => (
              <th key={c.key} style={{
                padding: "6px 10px",
                textAlign: i === 0 ? "center" : "right",
                color: "#64748b", fontWeight: 600,
                borderBottom: "1px solid #e2e8f0",
              }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, ri) => (
            <tr key={ri} style={{ background: ri % 2 === 0 ? "#fff" : "#f8fafc" }}>
              {columns.map((c, ci) => {
                const val = row[c.key];
                return (
                  <td key={c.key} style={{
                    padding: "6px 10px",
                    textAlign: ci === 0 ? "center" : "right",
                    color: "#1e293b",
                    borderBottom: "1px solid #f1f5f9",
                  }}>
                    {val ?? "—"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Warning pill ─────────────────────────────────────────────────────────────

function WarnPill({ text }: { text: string }) {
  return (
    <div style={{
      display: "inline-block", padding: "3px 10px",
      background: "#fef9c3", color: "#854d0e",
      borderRadius: 20, fontSize: 11, fontWeight: 600, marginBottom: 8,
    }}>
      {text}
    </div>
  );
}

// ─── Bank report ──────────────────────────────────────────────────────────────

function BankReport({ data, quote }: { data: BankAnalysisResponse; quote: MarketDataQuote | null }) {
  const name = data.company?.companyName ?? data.ticker;
  const ind  = data.indicators;

  const indicatorCards = [
    { label: "ROE",            value: fmtPct(ind?.roe),            note: "Retorno sobre PL" },
    { label: "ROA",            value: fmtPct(ind?.roa),            note: "Retorno sobre ativos" },
    { label: "PL / Ativos",    value: fmtPct(ind?.equityToAssets), note: "Capitalização" },
    { label: "Cresc. Lucro",   value: fmtPct(ind?.netIncomeGrowthYoY), note: "Variação YoY" },
    { label: "Cresc. Ativos",  value: fmtPct(ind?.assetGrowthYoY), note: "Variação YoY" },
  ];

  const tableRows = data.annual.map((r: BankFinancialRecord) => ({
    fiscalYear: r.fiscalYear,
    totalAssets: fmtBRL(r.totalAssets),
    equity:      fmtBRL(r.equity),
    netIncome:   fmtBRL(r.netIncome),
  }));

  return (
    <ReportShell ticker={data.ticker} modelLabel="Modelo Bancário" sourceLabel="CVM — DFP banco">
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>
          {name} ({data.ticker})
        </div>
        <div style={{ fontSize: 13, color: "#64748b" }}>Relatório bancário — Dados anuais CVM</div>
      </div>

      {data.warnings?.map((w, i) => <WarnPill key={i} text={w} />)}

      <QuoteBlock quote={quote} />

      <ReportSection title="Indicadores bancários">
        <ReportMetricGrid items={indicatorCards} />
      </ReportSection>

      <ReportSection title="Histórico anual">
        <AnnualTable
          rows={tableRows}
          columns={[
            { key: "fiscalYear",  label: "Ano" },
            { key: "totalAssets", label: "Ativos Totais" },
            { key: "equity",      label: "Patrimônio Líq." },
            { key: "netIncome",   label: "Lucro Líq." },
          ]}
        />
      </ReportSection>
    </ReportShell>
  );
}

// ─── FII report ───────────────────────────────────────────────────────────────

function FiiReport({ data, quote }: { data: FiiAnalysisResponse; quote: MarketDataQuote | null }) {
  const name = data.fund?.name ?? data.ticker;
  const ind  = data.indicators;
  const hasEnoughData = (ind?.distributionCoverageMonths ?? 0) >= 6;

  const indicatorCards = [
    { label: "VP por Cota",   value: fmtBRLPerShare(ind?.netAssetValuePerShare),        note: "Valor patrimonial" },
    { label: "Últ. Rendim.", value: fmtBRLPerShare(ind?.lastDistributionPerShare),      note: "Por cota" },
    { label: "DY 12m",        value: hasEnoughData ? fmtPct(ind?.dividendYield12m) : "—",
      note: hasEnoughData ? "Dist. / preço" : "Dados insuficientes" },
    { label: "P/VP",          value: ind?.priceToBookValuePerShare != null ? ind.priceToBookValuePerShare.toFixed(2).replace(".", ",") + "×" : "—",
      note: "Preço / valor patrimonial" },
  ];

  return (
    <ReportShell ticker={data.ticker} modelLabel="Modelo FII" sourceLabel="CVM — Informe Mensal">
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>
          {name} ({data.ticker})
        </div>
        <div style={{ fontSize: 13, color: "#64748b" }}>Relatório de FII — Informes mensais CVM</div>
      </div>

      {!hasEnoughData && (
        <WarnPill text="Menos de 6 meses de distribuições disponíveis — DY 12m não exibido" />
      )}
      {data.warnings?.map((w, i) => <WarnPill key={i} text={w} />)}

      <QuoteBlock quote={quote} />

      <ReportSection title="Indicadores do fundo">
        <ReportMetricGrid items={indicatorCards} />
      </ReportSection>

      {ind?.twelveMonthDistributionPerShare != null && hasEnoughData && (
        <ReportSection title="Distribuições">
          <ReportMetricGrid items={[
            {
              label: "Dist. acum. 12m",
              value: fmtBRLPerShare(ind.twelveMonthDistributionPerShare),
              note: "Por cota — soma dos últimos 12 meses",
            },
            {
              label: "Meses com dados",
              value: String(ind.distributionCoverageMonths),
              note: "Dos últimos 12 informes mensais",
            },
          ]} />
        </ReportSection>
      )}
    </ReportShell>
  );
}

// ─── Insurance report ─────────────────────────────────────────────────────────

function InsuranceReport({ data, quote }: { data: InsuranceAnalysisResponse; quote: MarketDataQuote | null }) {
  const name = data.company?.companyName ?? data.ticker;
  const ind  = data.indicators;

  const indicatorCards = [
    { label: "ROE",            value: fmtPct(ind?.roe),            note: "Retorno sobre PL" },
    { label: "ROA",            value: fmtPct(ind?.roa),            note: "Retorno sobre ativos" },
    { label: "PL / Ativos",    value: fmtPct(ind?.equityToAssets), note: "Capitalização" },
    { label: "Índice Sinistro",value: fmtPct(ind?.claimsRatio),    note: "Sinistros / prêmios" },
    { label: "Cresc. Lucro",   value: fmtPct(ind?.netIncomeGrowthYoY), note: "Variação YoY" },
  ];

  const tableRows = data.annual.map((r: InsuranceFinancialRecord) => ({
    fiscalYear:        r.fiscalYear,
    totalAssets:       fmtBRL(r.totalAssets),
    equity:            fmtBRL(r.equity),
    netIncome:         fmtBRL(r.netIncome),
    insurancePremiums: fmtBRL(r.insurancePremiums),
  }));

  return (
    <ReportShell ticker={data.ticker} modelLabel="Modelo Seguradora" sourceLabel="CVM — DFP seguradora">
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>
          {name} ({data.ticker})
        </div>
        <div style={{ fontSize: 13, color: "#64748b" }}>Relatório de seguradora — Dados anuais CVM</div>
      </div>

      {data.warnings?.map((w, i) => <WarnPill key={i} text={w} />)}

      <QuoteBlock quote={quote} />

      <ReportSection title="Indicadores de seguradora">
        <ReportMetricGrid items={indicatorCards} />
      </ReportSection>

      <ReportSection title="Histórico anual">
        <AnnualTable
          rows={tableRows}
          columns={[
            { key: "fiscalYear",        label: "Ano" },
            { key: "totalAssets",       label: "Ativos Totais" },
            { key: "equity",            label: "Patrimônio Líq." },
            { key: "netIncome",         label: "Lucro Líq." },
            { key: "insurancePremiums", label: "Prêmios" },
          ]}
        />
      </ReportSection>
    </ReportShell>
  );
}

// ─── Informational report (ETF / BDR / fund) ──────────────────────────────────

function InformationalReport({ ticker, quote }: { ticker: string; quote: MarketDataQuote | null }) {
  const info = getInstrumentInfo(ticker);
  const typeLabel =
    info.instrumentType === "etf"  ? "ETF — Fundo de Índice" :
    info.instrumentType === "bdr"  ? "BDR — Recibo de Ativo Estrangeiro" :
    info.instrumentType === "fund" ? "Fundo Listado" :
    "Instrumento de mercado";

  return (
    <ReportShell ticker={ticker} modelLabel="Informativo" sourceLabel="Camada informativa">
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>
          {info.name} ({ticker})
        </div>
        <div style={{ fontSize: 13, color: "#64748b" }}>
          {typeLabel} — relatório informativo
        </div>
      </div>

      <div style={{
        padding: "10px 16px", background: "#e0f2fe", borderRadius: 8,
        fontSize: 12, color: "#0369a1", marginBottom: 20,
      }}>
        Instrumento informativo — análise fundamentalista industrial não aplicável
      </div>

      <QuoteBlock quote={quote} />

      <ReportSection title="Sobre o instrumento">
        <p style={{ fontSize: 13, color: "#1e293b", lineHeight: 1.7, margin: 0 }}>
          {info.description}
        </p>
      </ReportSection>

      <ReportSection title="Por que não há análise fundamentalista?">
        <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.7, margin: 0 }}>
          {info.whyNoFundamentalAnalysis}
        </p>
      </ReportSection>
    </ReportShell>
  );
}

// ─── Unavailable report ───────────────────────────────────────────────────────

function UnavailableReport({ ticker }: { ticker: string }) {
  return (
    <ReportShell ticker={ticker} modelLabel="Indisponível">
      <div style={{ textAlign: "center", padding: "48px 24px" }}>
        <div style={{ fontSize: 36, marginBottom: 16 }}>—</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>
          Relatório indisponível
        </div>
        <div style={{ fontSize: 14, color: "#64748b", maxWidth: 420, margin: "0 auto" }}>
          Este ticker não possui cobertura ativa na plataforma. Pode ter sido descontinuado,
          incorporado ou estar fora do universo B3 cadastrado.
        </div>
      </div>
    </ReportShell>
  );
}

// ─── Fallback report (quote_only / sector_specific_pending) ───────────────────

function FallbackReport({ ticker, quote, reason }: {
  ticker: string;
  quote:  MarketDataQuote | null;
  reason: "quote_only" | "sector_specific_pending" | string;
}) {
  const message =
    reason === "sector_specific_pending"
      ? "O modelo específico para este setor está em desenvolvimento. Os dados de mercado estão disponíveis abaixo quando aplicável."
      : "Este ativo está cadastrado na plataforma, mas os dados fundamentalistas detalhados não estão disponíveis no momento.";

  return (
    <ReportShell ticker={ticker} modelLabel="Dados limitados">
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>
          {ticker}
        </div>
        <div style={{ fontSize: 13, color: "#64748b" }}>Cobertura parcial</div>
      </div>

      <div style={{
        padding: "12px 16px", background: "#f8fafc", borderRadius: 8,
        fontSize: 13, color: "#475569", marginBottom: 20,
        border: "1px solid #e2e8f0",
      }}>
        {message}
      </div>

      <QuoteBlock quote={quote} />
    </ReportShell>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ReportPage({ params, searchParams }: Props) {
  const { ticker } = await params;
  const sp         = await searchParams;
  const source     = sp.source ?? "mock";
  const upper      = ticker.toUpperCase();

  const b3Entry   = B3_UNIVERSE.find(a => a.ticker === upper);
  const modelRoute = b3Entry ? resolveModelRoute(b3Entry) : "unavailable";

  // Industrial path — hand off to existing client component (unchanged behaviour).
  if (modelRoute === "industrial") {
    return <ReportPageClient ticker={upper} source={source} />;
  }

  // Quote is useful for all non-unavailable routes.
  const quote = modelRoute !== "unavailable"
    ? await getBrapiQuote(upper).catch(() => null)
    : null;

  if (modelRoute === "bank") {
    const data = readBankCache(upper);
    if (!data) return <UnavailableReport ticker={upper} />;
    return <BankReport data={data} quote={quote} />;
  }

  if (modelRoute === "fii") {
    const data = readFiiCache(upper);
    if (!data) return <UnavailableReport ticker={upper} />;
    return <FiiReport data={data} quote={quote} />;
  }

  if (modelRoute === "insurance") {
    const data = readInsuranceCache(upper);
    if (!data) return <UnavailableReport ticker={upper} />;
    return <InsuranceReport data={data} quote={quote} />;
  }

  if (modelRoute === "informational_instrument") {
    return <InformationalReport ticker={upper} quote={quote} />;
  }

  if (modelRoute === "unavailable") {
    return <UnavailableReport ticker={upper} />;
  }

  // quote_only / sector_specific_pending
  return <FallbackReport ticker={upper} quote={quote} reason={modelRoute} />;
}
