"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { getCompanyData } from "@/data/companies";
import { buildFundamentalIndicators } from "@/lib/fundamentals/indicators";
import type { NormalizedFinancials } from "@/lib/cvm/types";
import type { MarketDataQuote } from "@/lib/market-data/types";
import ReportHeader from "@/components/report/ReportHeader";
import ReportSection from "@/components/report/ReportSection";
import ReportMetricGrid from "@/components/report/ReportMetricGrid";
import ReportPrintButton from "@/components/report/ReportPrintButton";

const MONO = "'JetBrains Mono', 'Courier New', monospace";

// ─── formatting helpers ───────────────────────────────────────────────────────

function fmtBRL(v: number | null): string {
  if (v === null) return "N/D";
  const abs = Math.abs(v);
  return (v < 0 ? "−R$ " : "R$ ") + abs.toFixed(1).replace(".", ",") + "B";
}

function fmtPct(v: number | null): string {
  if (v === null) return "N/D";
  return v.toFixed(1).replace(".", ",") + "%";
}

function fmtX(v: number | null): string {
  if (v === null) return "N/D";
  return v.toFixed(1).replace(".", ",") + "×";
}

// ─── Historical financials table ──────────────────────────────────────────────

function HistoricalTable({ financials }: { financials: NormalizedFinancials[] }) {
  const rows = [...financials].sort((a, b) => a.fiscalYear - b.fiscalYear);
  const heads = ["Ano", "Receita", "EBIT", "Lucro Líq.", "CFO", "Capex", "FCL", "Dívida Líq."];

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, fontFamily: MONO }}>
        <thead>
          <tr style={{ background: "#f8fafc" }}>
            {heads.map((h, i) => (
              <th key={h} style={{
                padding: "6px 10px",
                textAlign: i === 0 ? "center" : "right",
                color: "#64748b", fontWeight: 600,
                borderBottom: "1px solid #e2e8f0",
                fontSize: 10, textTransform: "uppercase", letterSpacing: "0.3px",
                whiteSpace: "nowrap",
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => {
            const bg = idx % 2 === 0 ? "#fff" : "#fafbfc";
            const rawNetDebt = r.netDebt ?? ((r.totalDebt ?? 0) - (r.cash ?? 0));
            const netDebt = rawNetDebt !== 0 ? rawNetDebt : null;
            const td: React.CSSProperties = {
              padding: "5px 10px", textAlign: "right",
              color: "#374151", borderBottom: "1px solid #f1f5f9",
              whiteSpace: "nowrap",
            };
            return (
              <tr key={r.fiscalYear} style={{ background: bg }}>
                <td style={{ ...td, textAlign: "center", fontWeight: 700, color: "#475569" }}>{r.fiscalYear}</td>
                <td style={td}>{fmtBRL(r.revenue ?? null)}</td>
                <td style={td}>{fmtBRL(r.ebit ?? null)}</td>
                <td style={td}>{fmtBRL(r.netIncome ?? null)}</td>
                <td style={td}>{fmtBRL(r.operatingCashFlow ?? null)}</td>
                <td style={td}>{fmtBRL(r.capex !== undefined ? -r.capex : null)}</td>
                <td style={{ ...td, fontWeight: 600 }}>{fmtBRL(r.freeCashFlow ?? null)}</td>
                <td style={td}>{fmtBRL(netDebt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── print styles ─────────────────────────────────────────────────────────────

const PRINT_CSS = `
  @media print {
    .no-print { display: none !important; }
    body { background: #fff !important; margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .report-page { box-shadow: none !important; border-radius: 0 !important; max-width: 100% !important; padding: 0 !important; }
    .report-section { page-break-inside: avoid; }
    table { page-break-inside: avoid; }
  }
  @page { size: A4; margin: 18mm 14mm; }
`;

// ─── main component ───────────────────────────────────────────────────────────

interface Props {
  ticker: string;
  source: string;
}

export default function ReportPageClient({ ticker, source }: Props) {
  const sourceMode = source === "cvm" ? "cvm" : "mock";
  const companyData = useMemo(() => getCompanyData(ticker), [ticker]);

  const [marketQuote, setMarketQuote]       = useState<MarketDataQuote | null>(null);
  const [cvmFinancials, setCvmFinancials]   = useState<NormalizedFinancials[] | null>(null);
  const [cvmUnavailable, setCvmUnavailable] = useState(false);
  const [loading, setLoading]               = useState(true);
  const [generatedAt]                       = useState(() =>
    new Date().toLocaleString("pt-BR", {
      day: "2-digit", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    })
  );

  useEffect(() => {
    const fetches: Promise<void>[] = [];

    if (companyData) {
      fetches.push(
        fetch(`/api/market-data/${encodeURIComponent(ticker)}`)
          .then(r => r.json())
          .then((body: { quote: MarketDataQuote | null }) => setMarketQuote(body.quote ?? null))
          .catch(() => {})
      );
    }

    fetches.push(
      fetch(`/api/cvm/financials/${encodeURIComponent(ticker)}`)
        .then(r => r.json())
        .then((body: { financials: NormalizedFinancials[]; error?: string }) => {
          if (body.financials?.length > 0) {
            setCvmFinancials(body.financials);
          } else {
            setCvmUnavailable(true);
          }
        })
        .catch(() => setCvmUnavailable(true))
    );

    Promise.all(fetches).finally(() => setLoading(false));
  }, [ticker, sourceMode, companyData]);

  const indicators = useMemo(
    () => buildFundamentalIndicators(cvmFinancials ?? [], marketQuote),
    [cvmFinancials, marketQuote]
  );

  // ── early returns (after all hooks) ──────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc" }}>
        <div style={{ fontSize: 14, color: "#64748b" }}>Gerando relatório...</div>
      </div>
    );
  }

  if (!companyData) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#f8fafc", gap: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: "#0f172a" }}>Ticker não encontrado</div>
        <div style={{ fontSize: 13, color: "#64748b" }}>Dados completos não disponíveis para {ticker}.</div>
        <Link href="/" style={{ fontSize: 12, color: "#2563eb", textDecoration: "none" }}>← Voltar ao dashboard</Link>
      </div>
    );
  }

  // ── derived values ────────────────────────────────────────────────────────────

  const company       = companyData.company;
  const displayPrice  = marketQuote?.price        ?? company.price;
  const displayChange = marketQuote?.changePercent ?? company.priceChangePct;
  const quoteSource   = marketQuote?.source        ?? null;
  const hasCvm        = (cvmFinancials?.length ?? 0) > 0;
  const effectiveSource: "mock" | "cvm" = hasCvm ? "cvm" : "mock";

  const snapshotItems = [
    { label: "Preço Atual", value: `R$ ${displayPrice.toFixed(2).replace(".", ",")}`, note: quoteSource === "brapi" ? "brapi" : "ilustrativo" },
    { label: "Variação Diária", value: `${displayChange >= 0 ? "+" : ""}${displayChange.toFixed(2).replace(".", ",")}%` },
    { label: "Valor de Mercado", value: company.marketCap },
    { label: "Enterprise Value", value: company.enterpriseValue },
    { label: "Moeda", value: company.currency },
    { label: "Setor", value: company.sector },
  ];

  const metricItems = companyData.metrics.map(m => ({
    label: m.label, value: m.value, note: m.suffix,
  }));

  const indicatorItems = indicators ? [
    { label: "CAGR Receita",           value: fmtPct(indicators.growth.revenueCAGR) },
    { label: "Crescimento YoY",        value: fmtPct(indicators.growth.revenueGrowthYoY) },
    { label: "Margem EBIT",            value: fmtPct(indicators.margins.ebitMargin) },
    { label: "Margem Líquida",         value: fmtPct(indicators.margins.netMargin) },
    { label: "Margem FCL",             value: fmtPct(indicators.margins.fcfMargin) },
    { label: "Conversão CFO/Lucro",    value: fmtX(indicators.cashConversion.cfoOverNetIncome) },
    { label: "Dívida Líquida / EBIT",  value: fmtX(indicators.debt.netDebtOverEbit) },
    { label: "P/L",                    value: fmtX(indicators.market.pe) },
    { label: "EV/EBIT",                value: fmtX(indicators.market.evOverEbit) },
  ] : [];

  const dataSourceNote = hasCvm
    ? "Este relatório usa dados extraídos da DFP anual consolidada da CVM. Capex, FCL e dívida líquida são normalizados ou calculados a partir das demonstrações. EBITDA pode usar EBIT como proxy quando D&A não estiver disponível."
    : "Dados CVM não disponíveis para este ticker. Os indicadores de mercado são baseados em dados ilustrativos.";

  // ── render ────────────────────────────────────────────────────────────────────

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />

      <div style={{ minHeight: "100vh", background: "#f0f2f5", padding: "24px 16px" }}>

        {/* Top bar — hidden in print */}
        <div className="no-print" style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          maxWidth: 900, margin: "0 auto 20px",
        }}>
          <Link href="/" style={{ fontSize: 12, color: "#2563eb", textDecoration: "none", fontWeight: 500 }}>
            ← Voltar ao Dashboard
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>
              {hasCvm ? "Dados CVM" : "Dados ilustrativos"}
            </span>
            <ReportPrintButton />
          </div>
        </div>

        {/* Report body */}
        <div className="report-page" style={{
          maxWidth: 900, margin: "0 auto", background: "#fff",
          borderRadius: 10, padding: "36px 44px",
          boxShadow: "0 1px 8px rgba(0,0,0,0.08)",
        }}>

          <ReportHeader
            company={company}
            source={effectiveSource}
            quoteSource={quoteSource}
            generatedAt={generatedAt}
          />

          {/* CVM unavailable notice */}
          {cvmUnavailable && (
            <div style={{
              background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6,
              padding: "10px 14px", marginBottom: 20, fontSize: 12, color: "#b45309",
            }}>
              Dados CVM não disponíveis para {ticker}. Os indicadores mostram dados do mercado disponíveis.
            </div>
          )}

          <ReportSection title="Informações da Empresa">
            <ReportMetricGrid items={snapshotItems} columns={3} />
          </ReportSection>

          <ReportSection title="Indicadores-Chave">
            <ReportMetricGrid items={metricItems} columns={3} />
          </ReportSection>

          {indicatorItems.length > 0 && (
            <ReportSection title="Indicadores Fundamentalistas" subtitle="Calculados a partir das demonstrações CVM">
              <ReportMetricGrid items={indicatorItems} columns={3} />
            </ReportSection>
          )}

          {hasCvm && cvmFinancials && cvmFinancials.length > 0 && (
            <ReportSection title="Histórico Financeiro" subtitle="DFP anual consolidada · valores em R$ bilhões">
              <HistoricalTable financials={cvmFinancials} />
            </ReportSection>
          )}

          <ReportSection title="Nota sobre os Dados">
            <p style={{ margin: 0, fontSize: 12, color: "#64748b", lineHeight: 1.7 }}>
              {dataSourceNote}
            </p>
          </ReportSection>

          {/* Disclaimer */}
          <div style={{
            marginTop: 24, paddingTop: 16, borderTop: "1px solid #e2e8f0",
            fontSize: 11, color: "#94a3b8", lineHeight: 1.8,
          }}>
            <strong style={{ display: "block", marginBottom: 3, color: "#64748b", fontWeight: 600 }}>
              Aviso Legal
            </strong>
            Este relatório tem finalidade educacional e demonstrativa. As informações apresentadas não
            constituem recomendação de investimento, oferta de compra ou venda de valores mobiliários,
            nem substituem análise profissional independente.
          </div>
        </div>
      </div>
    </>
  );
}
