"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import NavBar from "@/components/dashboard/NavBar";
import CompanyHeader from "@/components/dashboard/CompanyHeader";
import MetricsRow from "@/components/dashboard/MetricsRow";
import HistoricalChart from "@/components/dashboard/HistoricalChart";
import MultiplesTable from "@/components/dashboard/MultiplesTable";
import DocumentsPanel from "@/components/dashboard/DocumentsPanel";
import CvmFinancialsTable from "@/components/dashboard/CvmFinancialsTable";
import DataSourceNotice from "@/components/dashboard/DataSourceNotice";
import FundamentalIndicators from "@/components/dashboard/FundamentalIndicators";
import FundamentalDiagnosis from "@/components/dashboard/FundamentalDiagnosis";
import CvmValidationStrip from "@/components/dashboard/CvmValidationStrip";
import type { CvmStripStatus } from "@/components/dashboard/CvmValidationStrip";
import { cvmFinancialsToDashboardFinancials } from "@/lib/cvm/transformers";
import {
  buildCompanyAnalysisDataFromCvm,
  isCvmAnalysisEligible,
  cvmAnalysisEligibilityReason,
} from "@/lib/cvm/cvm-analysis-builder";
import type { NormalizedFinancials } from "@/lib/cvm/types";
import { getCompanyData } from "@/data/companies";
import { B3_UNIVERSE } from "@/data/b3-universe";
import type { B3Asset } from "@/data/b3-universe";
import type { MarketDataQuote } from "@/lib/market-data/types";
import { COVERAGE_BADGE, COVERAGE_DESCRIPTION, type CoverageStatus } from "@/data/coverage-types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildPreliminaryCompany(b3Entry: B3Asset, quote: MarketDataQuote | null) {
  const price = quote?.price ?? 0;
  const mcRaw = quote?.marketCap;
  const mcStr = mcRaw ? `R$ ${(mcRaw / 1_000_000_000).toFixed(1).replace(".", ",")}B` : "—";
  return {
    name:            b3Entry.companyName,
    ticker:          b3Entry.ticker,
    exchange:        "B3",
    sector:          b3Entry.sector,
    price,
    priceChangePct:  quote?.changePercent ?? 0,
    marketCap:       mcStr,
    enterpriseValue: "—",
    currency:        "BRL",
  };
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = ["Visão Geral", "Financeiros", "Indicadores", "Comparáveis", "Notícias e documentos"];

function TabBar({ activeTab, onTabChange }: { activeTab: string; onTabChange: (t: string) => void }) {
  return (
    <div style={{ display: "flex", gap: 0, padding: "0 24px", background: "#fff", borderBottom: "1px solid #e2e8f0" }}>
      {TABS.map(tab => (
        <button
          key={tab}
          onClick={() => onTabChange(tab)}
          style={{
            padding: "10px 16px", fontSize: 13, fontWeight: 500,
            color: activeTab === tab ? "#2563eb" : "#64748b",
            background: "none", border: "none",
            borderBottom: activeTab === tab ? "2px solid #2563eb" : "2px solid transparent",
            cursor: "pointer", fontFamily: "inherit", marginBottom: -1,
          }}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

// ─── No-ticker splash ─────────────────────────────────────────────────────────

const QUICK_TICKERS = ["WEGE3", "PETR4", "VALE3", "KLBN11", "LREN3"];

function NoTickerView({ onTicker }: { onTicker: (t: string) => void }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "80px 24px", textAlign: "center",
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: 14, background: "#f1f5f9",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 22, marginBottom: 18,
      }}>
        🔍
      </div>
      <h2 style={{ margin: "0 0 10px", fontSize: 18, fontWeight: 700, color: "#0f172a" }}>
        Busque uma empresa para iniciar a análise fundamentalista.
      </h2>
      <p style={{ margin: "0 0 20px", fontSize: 14, color: "#64748b", maxWidth: 420, lineHeight: 1.6 }}>
        Use a barra de busca acima ou selecione um ticker abaixo.
      </p>
      <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
        {QUICK_TICKERS.map(t => (
          <button
            key={t}
            onClick={() => onTicker(t)}
            style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 600,
              color: "#475569", background: "#fff", border: "1px solid #e2e8f0",
              padding: "5px 12px", borderRadius: 6, cursor: "pointer",
            }}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Empty / coverage state ───────────────────────────────────────────────────

function EmptyStateView({
  ticker, companyName, coverageStatus, quote, quoteLoading,
}: {
  ticker: string;
  companyName: string;
  coverageStatus?: CoverageStatus;
  quote?: MarketDataQuote | null;
  quoteLoading?: boolean;
}) {
  const status = coverageStatus ?? "unavailable";
  const badge = COVERAGE_BADGE[status];
  const description = COVERAGE_DESCRIPTION[status];
  const showQuote =
    (status === "quote_only" || status === "sector_specific_model_required") &&
    quote != null && !quoteLoading;
  const isUp = (quote?.changePercent ?? 0) >= 0;

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "72px 24px", textAlign: "center",
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 14, background: "#f1f5f9",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 24, marginBottom: 20,
      }}>
        📊
      </div>
      <div style={{
        background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14,
        padding: "36px 48px", maxWidth: 540,
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 16 }}>
          <div style={{
            background: "#f1f5f9", color: "#475569",
            fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 6,
            fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.5px",
          }}>
            {ticker}
          </div>
          <div style={{
            fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 20,
            background: badge.bg, color: badge.color,
          }}>
            {badge.label}
          </div>
        </div>
        <h2 style={{ margin: "0 0 10px", fontSize: 18, fontWeight: 700, color: "#0f172a" }}>
          {companyName}
        </h2>
        <p style={{ margin: "0 0 8px", fontSize: 14, color: "#374151", lineHeight: 1.6 }}>
          {description}
        </p>
        {status === "cvm_financials" && (
          <p style={{ margin: "0 0 8px", fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>
            Os dados da DFP/CVM já estão integrados, mas o histórico disponível ainda é insuficiente para gerar a análise completa.
          </p>
        )}
        {status === "sector_specific_model_required" && (
          <p style={{ margin: "0 0 8px", fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>
            Bancos e seguradoras são avaliados por P/VPA e ROE bancário. FIIs por NAV, DY e composição de carteira. ETFs e BDRs replicam índices ou ativos estrangeiros. Essas métricas diferem estruturalmente das usadas em empresas industriais.
          </p>
        )}
        {status === "unavailable" && (
          <p style={{ margin: "0 0 8px", fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>
            Este ticker está no universo B3, mas ainda sem dados financeiros integrados.
          </p>
        )}
        {showQuote && (
          <div style={{
            marginTop: 20, padding: "14px 20px",
            background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10,
          }}>
            <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 6 }}>
              Cotação atual · Fonte: brapi
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#0f172a", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "-1px" }}>
              R$ {quote!.price.toFixed(2).replace(".", ",")}
            </div>
            <div style={{ fontSize: 13, fontWeight: 500, color: isUp ? "#16a34a" : "#dc2626", fontFamily: "'JetBrains Mono', monospace", marginTop: 3 }}>
              {isUp ? "▲" : "▼"} {Math.abs(quote!.changePercent ?? 0).toFixed(2).replace(".", ",")}% hoje
            </div>
          </div>
        )}
        {quoteLoading && (status === "quote_only" || status === "sector_specific_model_required") && (
          <div style={{ marginTop: 16, fontSize: 12, color: "#94a3b8" }}>
            Buscando cotação...
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Source banner (reused inside the full and preliminary dashboards) ─────────

type BannerVariant = "preview" | "market_only" | "cvm_analysis" | "cvm_data" | "mock";

function SourceBanner({ variant, cvmLoading }: { variant: BannerVariant; cvmLoading?: boolean }) {
  if (variant === "preview") {
    return (
      <div style={{
        padding: "7px 24px", background: "#f0f9ff",
        borderBottom: "1px solid #bae6fd",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.5px",
          textTransform: "uppercase" as const,
          color: "#0369a1", background: "#e0f2fe",
          padding: "2px 7px", borderRadius: 4,
        }}>
          Prévia Rápida
        </span>
        <span style={{ fontSize: 12, color: "#0369a1" }}>
          Dados de mercado via brapi · Os dados oficiais da CVM ainda estão sendo carregados.
        </span>
      </div>
    );
  }

  if (variant === "market_only") {
    return (
      <div style={{
        padding: "7px 24px", background: "#f8fafc",
        borderBottom: "1px solid #e2e8f0",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.5px",
          textTransform: "uppercase" as const,
          color: "#475569", background: "#f1f5f9",
          padding: "2px 7px", borderRadius: 4,
        }}>
          Dados de Mercado
        </span>
        <span style={{ fontSize: 12, color: "#64748b" }}>
          Dados CVM indisponíveis para este ativo. Exibindo apenas cotação de mercado.
        </span>
      </div>
    );
  }

  if (variant === "cvm_analysis") {
    return (
      <div style={{
        padding: "7px 24px", background: "#faf5ff",
        borderBottom: "1px solid #ddd6fe",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.5px",
          textTransform: "uppercase" as const,
          color: "#7c3aed", background: "#ede9fe",
          padding: "2px 7px", borderRadius: 4,
        }}>
          Análise CVM
        </span>
        <span style={{ fontSize: 12, color: "#6d28d9" }}>
          Análise fundamentalista com dados da DFP anual consolidada. Dados em validação — não constitui recomendação de investimento.
        </span>
      </div>
    );
  }

  if (variant === "cvm_data") {
    return (
      <div style={{
        padding: "7px 24px", background: "#eff6ff",
        borderBottom: "1px solid #bfdbfe",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.5px",
          textTransform: "uppercase" as const,
          color: "#2563eb", background: "#dbeafe",
          padding: "2px 7px", borderRadius: 4,
        }}>
          Dados CVM
        </span>
        <span style={{ fontSize: 12, color: "#1d4ed8" }}>
          Financeiros extraídos da DFP anual consolidada (CVM Dados Abertos). Não constitui recomendação de investimento.
        </span>
        {cvmLoading && (
          <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: "auto" }}>
            Aguardando CVM...
          </span>
        )}
      </div>
    );
  }

  // mock
  return (
    <div style={{
      padding: "7px 24px", background: "#fffbeb",
      borderBottom: "1px solid #fde68a",
      display: "flex", alignItems: "center", gap: 8,
    }}>
      <span style={{
        fontSize: 10, fontWeight: 700, letterSpacing: "0.5px",
        textTransform: "uppercase" as const,
        color: "#b45309", background: "#fef3c7",
        padding: "2px 7px", borderRadius: 4,
      }}>
        Dados Ilustrativos
      </span>
      <span style={{ fontSize: 12, color: "#92400e" }}>
        Dados de demonstração — não auditados, não oficiais. Dados CVM não disponíveis para este ticker.
      </span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DashboardPageClient() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const selectedTicker = searchParams.get("ticker")?.toUpperCase() ?? null;

  const [activeTab, setActiveTab]           = useState("Visão Geral");
  const [marketQuote, setMarketQuote]       = useState<MarketDataQuote | null>(null);
  const [quoteLoading, setQuoteLoading]     = useState(false);
  const [cvmFinancials, setCvmFinancials]   = useState<NormalizedFinancials[] | null>(null);
  const [cvmLoading, setCvmLoading]         = useState(false);
  const [cvmError, setCvmError]             = useState(false);
  const [financialSource, setFinancialSource] = useState<"mock" | "cvm">("cvm");

  // ── Static lookups (no network) ───────────────────────────────────────────
  const companyData = useMemo(
    () => (selectedTicker ? getCompanyData(selectedTicker) : null),
    [selectedTicker],
  );

  const b3Entry = useMemo(
    () => B3_UNIVERSE.find(c => c.ticker === selectedTicker),
    [selectedTicker],
  );

  // ── Derived from CVM fetch ────────────────────────────────────────────────
  const cvmAnalysisData = useMemo(() => {
    if (companyData || !cvmFinancials || cvmFinancials.length === 0 || !b3Entry) return null;
    return buildCompanyAnalysisDataFromCvm({ b3Entry, cvmFinancials, marketQuote });
  }, [companyData, cvmFinancials, marketQuote, b3Entry]);

  const effectiveCompanyData = companyData ?? cvmAnalysisData;
  const isCvmAnalysis        = !companyData && cvmAnalysisData !== null;

  // True for tickers that can produce a CVM-driven analysis dashboard.
  const isEligibleForCvm = b3Entry !== undefined && isCvmAnalysisEligible(b3Entry);

  // CVM fetch has settled (data arrived or failed) — loading is done.
  const cvmSettled = !cvmLoading && cvmFinancials !== null;

  // Human-readable reason why the settled CVM data cannot produce a full analysis.
  const insufficiencyReason = useMemo(() => {
    if (!cvmSettled || !isEligibleForCvm || companyData || !cvmFinancials) return null;
    if (cvmFinancials.length === 0) return "Nenhum dado encontrado para este ticker.";
    return cvmAnalysisEligibilityReason(cvmFinancials);
  }, [cvmSettled, isEligibleForCvm, companyData, cvmFinancials]);

  // The preliminary shell shows instead of a full-page loading block when CVM
  // data is still loading for a CVM-eligible ticker that has no mock data.
  const showPreliminaryShell = isEligibleForCvm && !effectiveCompanyData;

  // Dev-mode render decision logging.
  useEffect(() => {
    if (process.env.NODE_ENV !== "development" || !selectedTicker) return;
    const branch =
      effectiveCompanyData  ? "full_dashboard" :
      showPreliminaryShell  ? "preliminary_shell" :
      "empty_state";
    console.group(`[dashboard] ${selectedTicker}`);
    console.log(`coverageStatus: ${b3Entry?.coverageStatus ?? "—"}`);
    console.log(`isEligibleForCvm: ${isEligibleForCvm}`);
    console.log(`cvmLoading: ${cvmLoading}`);
    if (cvmFinancials !== null) {
      console.log(`cvmFinancials: ${cvmFinancials.length} years${cvmFinancials.length > 0 ? ` — cvmAnalysisData: ${cvmAnalysisData ? "non-null" : "null"}` : ""}`);
    } else {
      console.log(`cvmFinancials: null (loading)`);
    }
    console.log(`marketQuote: ${marketQuote ? `price=${marketQuote.price}, marketCap=${marketQuote.marketCap ?? "absent"}` : "null"}`);
    console.log(`effectiveCompanyData: ${effectiveCompanyData ? "non-null" : "null"}`);
    console.log(`render branch: ${branch}`);
    console.groupEnd();
  }, [selectedTicker, b3Entry, isEligibleForCvm, cvmLoading, cvmFinancials, marketQuote, cvmAnalysisData, effectiveCompanyData, showPreliminaryShell]);

  // Strip status for the inline CVM validation indicator.
  const cvmStripStatus: CvmStripStatus =
    cvmError      ? "error" :
    cvmSettled && (cvmFinancials!.length === 0 || insufficiencyReason !== null) ? "insufficient" :
    "loading";

  const activeFinancials = useMemo(() => {
    if (financialSource === "cvm" && cvmFinancials && cvmFinancials.length > 0) {
      return cvmFinancialsToDashboardFinancials(cvmFinancials);
    }
    if (isCvmAnalysis && cvmFinancials && cvmFinancials.length > 0) {
      return cvmFinancialsToDashboardFinancials(cvmFinancials);
    }
    return effectiveCompanyData?.financials ?? [];
  }, [financialSource, cvmFinancials, isCvmAnalysis, effectiveCompanyData]);

  const indicatorFinancials: NormalizedFinancials[] = cvmFinancials ?? [];

  // ── Reset state on ticker change ──────────────────────────────────────────
  useEffect(() => {
    setActiveTab("Visão Geral");
    setFinancialSource("cvm");
    setCvmError(false);
  }, [selectedTicker]);

  // ── Market quote fetch ────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedTicker) return;
    const controller = new AbortController();
    let active = true;
    setMarketQuote(null);
    setQuoteLoading(true);

    fetch(`/api/market-data/${encodeURIComponent(selectedTicker)}`, { signal: controller.signal })
      .then(res => res.json())
      .then((body: { quote: MarketDataQuote | null }) => {
        if (active) setMarketQuote(body.quote ?? null);
      })
      .catch(() => {})
      .finally(() => { if (active) setQuoteLoading(false); });

    return () => { active = false; controller.abort(); };
  }, [selectedTicker]);

  // ── CVM financials fetch ──────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedTicker || !b3Entry) {
      setCvmFinancials(null);
      setCvmLoading(false);
      return;
    }

    const controller = new AbortController();
    let active = true;
    setCvmFinancials(null);
    setCvmLoading(true);
    setCvmError(false);

    fetch(`/api/cvm/financials/${encodeURIComponent(selectedTicker)}`, { signal: controller.signal })
      .then(res => res.json())
      .then((body: { financials: NormalizedFinancials[] }) => {
        if (active) {
          const rows = body.financials ?? [];
          setCvmFinancials(rows);
          setFinancialSource(rows.length > 0 ? "cvm" : "mock");
        }
      })
      .catch(() => {
        if (active) {
          setCvmFinancials([]);
          setFinancialSource("mock");
          setCvmError(true);
        }
      })
      .finally(() => { if (active) setCvmLoading(false); });

    return () => { active = false; controller.abort(); };
  }, [selectedTicker, b3Entry]);

  function handleSelectCompany(ticker: string) {
    router.push(`/dashboard?ticker=${encodeURIComponent(ticker)}`);
  }

  function handleSourceChange(source: "mock" | "cvm") {
    setFinancialSource(source);
    if (source === "mock" || cvmFinancials !== null || !selectedTicker) return;
    setCvmLoading(true);
    fetch(`/api/cvm/financials/${encodeURIComponent(selectedTicker)}`)
      .then(res => res.json())
      .then((body: { financials: NormalizedFinancials[] }) => {
        setCvmFinancials(body.financials ?? []);
      })
      .catch(() => { setCvmFinancials([]); })
      .finally(() => { setCvmLoading(false); });
  }

  // ── Source banner variant for the full dashboard ──────────────────────────
  const fullDashboardBanner: BannerVariant =
    isCvmAnalysis                                               ? "cvm_analysis" :
    financialSource === "cvm" && cvmFinancials?.length! > 0   ? "cvm_data" :
    "mock";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#f0f2f5" }}>
      <NavBar onSelectCompany={handleSelectCompany} selectedTicker={selectedTicker ?? ""} />

      {/* ── State 1: no ticker ──────────────────────────────────────────────── */}
      {!selectedTicker ? (
        <NoTickerView onTicker={handleSelectCompany} />

      /* ── State 2: full dashboard (mock data or successful CVM analysis) ─── */
      ) : effectiveCompanyData ? (
        <>
          <CompanyHeader
            company={effectiveCompanyData.company}
            quote={marketQuote}
            quoteLoading={quoteLoading}
            exportUrl={!isCvmAnalysis ? `/relatorio/${selectedTicker}?source=${financialSource}` : undefined}
          />
          <MetricsRow metrics={effectiveCompanyData.metrics} />
          <SourceBanner variant={fullDashboardBanner} cvmLoading={cvmLoading} />
          <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

          <div style={{ padding: "18px 24px" }}>
            {activeTab === "Visão Geral" && (
              <div
                className="main-grid"
                style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 14, alignItems: "start" }}
              >
                <div>
                  <HistoricalChart data={activeFinancials} />
                  {indicatorFinancials.length > 0 && (
                    <FundamentalDiagnosis financials={indicatorFinancials} />
                  )}
                </div>
                <div>
                  <MultiplesTable data={effectiveCompanyData.multiples} />
                  <DocumentsPanel ticker={selectedTicker} />
                </div>
              </div>
            )}

            {activeTab === "Financeiros" && (
              <div style={{ maxWidth: 900 }}>
                {!isCvmAnalysis && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>
                      Fonte dos financeiros:
                    </span>
                    <div style={{ display: "flex", border: "1px solid #e2e8f0", borderRadius: 6, overflow: "hidden" }}>
                      {(["mock", "cvm"] as const).map((src, i) => (
                        <button
                          key={src}
                          onClick={() => handleSourceChange(src)}
                          style={{
                            padding: "5px 12px", fontSize: 12, fontWeight: 500,
                            background: financialSource === src ? "#2563eb" : "#fff",
                            color: financialSource === src ? "#fff" : "#64748b",
                            border: "none", cursor: "pointer", fontFamily: "inherit",
                            borderRight: i === 0 ? "1px solid #e2e8f0" : "none",
                            transition: "background 0.15s, color 0.15s",
                          }}
                        >
                          {src === "mock" ? "Dados ilustrativos" : "Dados CVM"}
                        </button>
                      ))}
                    </div>
                    {financialSource === "cvm" && cvmLoading && (
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>Carregando...</span>
                    )}
                    {financialSource === "cvm" && !cvmLoading && cvmFinancials !== null && cvmFinancials.length === 0 && (
                      <span style={{ fontSize: 11, color: "#f59e0b", fontWeight: 500 }}>
                        Dados CVM ainda não disponíveis para este ticker. Usando dados ilustrativos.
                      </span>
                    )}
                  </div>
                )}
                {isCvmAnalysis ? (
                  <DataSourceNotice sourceMode="cvm_analysis" quoteSource={marketQuote?.source ?? null} />
                ) : (
                  !cvmLoading && (
                    <DataSourceNotice
                      sourceMode={financialSource}
                      hasCvmData={cvmFinancials !== null && cvmFinancials.length > 0}
                      quoteSource={marketQuote?.source ?? null}
                    />
                  )
                )}
                <HistoricalChart data={activeFinancials} />
                <CvmFinancialsTable ticker={selectedTicker} enabled={true} />
                {!isCvmAnalysis && (
                  <div style={{
                    background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10,
                    padding: "14px 18px", fontSize: 12, color: "#94a3b8", lineHeight: 1.6,
                  }}>
                    Os dados CVM exibidos acima vêm da DFP anual consolidada e ainda estão em validação.
                  </div>
                )}
              </div>
            )}

            {activeTab === "Indicadores" && (
              <div style={{ maxWidth: 760 }}>
                <FundamentalIndicators financials={indicatorFinancials} marketQuote={marketQuote} />
                {indicatorFinancials.length === 0 && companyData && (
                  <div style={{
                    background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10,
                    padding: "18px 22px", fontSize: 13, color: "#64748b", lineHeight: 1.6,
                  }}>
                    Indicadores calculados a partir de dados CVM. Selecione &quot;Dados CVM&quot; na aba Financeiros para habilitar, ou busque uma empresa com análise CVM disponível.
                  </div>
                )}
              </div>
            )}

            {activeTab === "Comparáveis" && (
              <div style={{ maxWidth: 760 }}>
                <MultiplesTable data={effectiveCompanyData.multiples} />
                {effectiveCompanyData.multiples.length === 0 && (
                  <div style={{
                    background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10,
                    padding: "36px 24px", fontSize: 13, color: "#94a3b8", textAlign: "center" as const,
                  }}>
                    Comparáveis setoriais não disponíveis para este ativo.
                  </div>
                )}
              </div>
            )}

            {activeTab === "Notícias e documentos" && (
              <div style={{ maxWidth: 700 }}>
                <DocumentsPanel ticker={selectedTicker} />
              </div>
            )}
          </div>
        </>

      /* ── State 3: preliminary shell — market data fast, CVM loading/failed ── */
      ) : showPreliminaryShell ? (
        <>
          <CompanyHeader
            company={buildPreliminaryCompany(b3Entry!, marketQuote)}
            quote={marketQuote}
            quoteLoading={quoteLoading}
          />

          <SourceBanner
            variant={cvmSettled && (cvmError || insufficiencyReason !== null) ? "market_only" : "preview"}
          />

          <div style={{ padding: "18px 24px" }}>
            <div
              className="main-grid"
              style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 14, alignItems: "start" }}
            >
              {/* Left: CVM validation strip */}
              <div>
                <CvmValidationStrip
                  ticker={selectedTicker}
                  status={cvmStripStatus}
                  insufficiencyReason={insufficiencyReason}
                />
              </div>

              {/* Right: documents load independently and don't block the dashboard */}
              <div>
                <DocumentsPanel ticker={selectedTicker} />
              </div>
            </div>
          </div>
        </>

      /* ── State 4: not eligible / quote-only / sector-specific / unavailable ── */
      ) : (
        <EmptyStateView
          ticker={selectedTicker}
          companyName={b3Entry?.companyName ?? selectedTicker}
          coverageStatus={b3Entry?.coverageStatus}
          quote={marketQuote}
          quoteLoading={quoteLoading}
        />
      )}
    </div>
  );
}
