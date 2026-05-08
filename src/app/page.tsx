"use client";

import { useState, useMemo, useEffect } from "react";
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
import { cvmFinancialsToDashboardFinancials } from "@/lib/cvm/transformers";
import { buildCompanyAnalysisDataFromCvm, isCvmAnalysisEligible } from "@/lib/cvm/cvm-analysis-builder";
import type { NormalizedFinancials } from "@/lib/cvm/types";
import { getCompanyData } from "@/data/companies";
import { B3_UNIVERSE } from "@/data/b3-universe";
import type { MarketDataQuote } from "@/lib/market-data/types";
import { COVERAGE_BADGE, COVERAGE_DESCRIPTION, type CoverageStatus } from "@/data/coverage-types";

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

function EmptyStateView({
  ticker,
  companyName,
  coverageStatus,
  quote,
  quoteLoading,
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
  const showQuote = status === "quote_only" && quote != null && !quoteLoading;
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

        {status === "cvm_analysis" && (
          <p style={{ margin: "0 0 8px", fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>
            Os dados CVM estão sendo buscados. Se o dashboard não aparecer, os dados disponíveis podem não ser suficientes para gerar a análise.
          </p>
        )}

        {status === "cvm_financials" && (
          <p style={{ margin: "0 0 8px", fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>
            Os dados financeiros reais da DFP/CVM já estão integrados. O dashboard completo será habilitado após normalização adicional.
          </p>
        )}

        {status === "sector_specific_model_required" && (
          <p style={{ margin: "0 0 8px", fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>
            Bancos, seguradoras, FIIs e holdings requerem metodologias específicas que estão em desenvolvimento.
          </p>
        )}

        {status === "unavailable" && (
          <p style={{ margin: "0 0 8px", fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>
            Este ticker já está no universo de busca. A integração de dados financeiros será adicionada nas próximas etapas.
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

        {quoteLoading && status === "quote_only" && (
          <div style={{ marginTop: 16, fontSize: 12, color: "#94a3b8" }}>
            Buscando cotação...
          </div>
        )}
      </div>
    </div>
  );
}

function CvmLoadingView({ ticker }: { ticker: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "72px 24px",
    }}>
      <div style={{
        background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14,
        padding: "36px 48px", maxWidth: 400, textAlign: "center",
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
      }}>
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.7px",
          textTransform: "uppercase" as const, color: "#94a3b8", marginBottom: 12,
        }}>
          Buscando dados CVM
        </div>
        <div style={{ fontSize: 14, color: "#374151" }}>
          Carregando demonstrações financeiras para <strong style={{ fontFamily: "'JetBrains Mono', monospace" }}>{ticker}</strong>...
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [activeTab, setActiveTab]     = useState("Visão Geral");
  const [selectedTicker, setSelected] = useState("WEGE3");
  const [marketQuote, setMarketQuote]     = useState<MarketDataQuote | null>(null);
  const [quoteLoading, setQuoteLoading]   = useState(false);
  const [cvmFinancials, setCvmFinancials] = useState<NormalizedFinancials[] | null>(null);
  const [cvmLoading, setCvmLoading]       = useState(false);
  const [financialSource, setFinancialSource] = useState<"mock" | "cvm">("cvm");

  const companyData = useMemo(() => getCompanyData(selectedTicker), [selectedTicker]);

  const b3Entry = useMemo(
    () => B3_UNIVERSE.find(c => c.ticker === selectedTicker),
    [selectedTicker],
  );

  // Build analysis data from CVM for companies without mock data.
  const cvmAnalysisData = useMemo(() => {
    if (companyData || !cvmFinancials || cvmFinancials.length === 0) return null;
    if (!b3Entry) return null;
    return buildCompanyAnalysisDataFromCvm({
      b3Entry,
      cvmFinancials,
      marketQuote,
    });
  }, [companyData, cvmFinancials, marketQuote, b3Entry]);

  const effectiveCompanyData = companyData ?? cvmAnalysisData;
  const isCvmAnalysis = !companyData && cvmAnalysisData !== null;

  // Active financials for charts: prefer CVM when available
  const activeFinancials = useMemo(() => {
    if (financialSource === "cvm" && cvmFinancials && cvmFinancials.length > 0) {
      return cvmFinancialsToDashboardFinancials(cvmFinancials);
    }
    if (isCvmAnalysis && cvmFinancials && cvmFinancials.length > 0) {
      return cvmFinancialsToDashboardFinancials(cvmFinancials);
    }
    return effectiveCompanyData?.financials ?? [];
  }, [financialSource, cvmFinancials, isCvmAnalysis, effectiveCompanyData]);

  // CVM financials available for indicators/diagnosis
  const indicatorFinancials: NormalizedFinancials[] = cvmFinancials ?? [];

  // Show loading for cvm_analysis companies while fetching
  const showCvmLoading =
    !effectiveCompanyData &&
    b3Entry !== undefined &&
    isCvmAnalysisEligible(b3Entry) &&
    (cvmLoading || quoteLoading);

  // ── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    setMarketQuote(null);
    setQuoteLoading(true);

    fetch(`/api/market-data/${encodeURIComponent(selectedTicker)}`)
      .then(res => res.json())
      .then((body: { quote: MarketDataQuote | null }) => {
        if (!cancelled) setMarketQuote(body.quote ?? null);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setQuoteLoading(false); });

    return () => { cancelled = true; };
  }, [selectedTicker]);

  // Fetch CVM financials for all companies that have a b3Entry.
  // For cvm_analysis companies this is the primary data source; for mock companies
  // it lets us prefer real CVM data over illustrative data when available.
  useEffect(() => {
    if (!b3Entry) {
      setCvmFinancials(null);
      setCvmLoading(false);
      return;
    }

    let cancelled = false;
    setCvmFinancials(null);
    setCvmLoading(true);

    fetch(`/api/cvm/financials/${encodeURIComponent(selectedTicker)}`)
      .then(res => res.json())
      .then((body: { financials: NormalizedFinancials[] }) => {
        if (!cancelled) {
          const rows = body.financials ?? [];
          setCvmFinancials(rows);
          if (rows.length > 0) {
            setFinancialSource("cvm");
          } else {
            setFinancialSource("mock");
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCvmFinancials([]);
          setFinancialSource("mock");
        }
      })
      .finally(() => { if (!cancelled) setCvmLoading(false); });

    return () => { cancelled = true; };
  }, [selectedTicker, b3Entry]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleSelectCompany(ticker: string) {
    setSelected(ticker);
    setActiveTab("Visão Geral");
    setFinancialSource("cvm");
    setCvmFinancials(null);
  }

  function handleSourceChange(source: "mock" | "cvm") {
    setFinancialSource(source);
    if (source === "mock") return;
    if (cvmFinancials !== null) return; // already loaded
    setCvmLoading(true);
    fetch(`/api/cvm/financials/${encodeURIComponent(selectedTicker)}`)
      .then(res => res.json())
      .then((body: { financials: NormalizedFinancials[]; error?: string }) => {
        setCvmFinancials(body.financials ?? []);
      })
      .catch(() => { setCvmFinancials([]); })
      .finally(() => { setCvmLoading(false); });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", background: "#f0f2f5" }}>
      <NavBar onSelectCompany={handleSelectCompany} selectedTicker={selectedTicker} />

      {effectiveCompanyData ? (
        <>
          <CompanyHeader
            company={effectiveCompanyData.company}
            quote={marketQuote}
            quoteLoading={quoteLoading}
            exportUrl={!isCvmAnalysis ? `/relatorio/${selectedTicker}?source=${financialSource}` : undefined}
          />
          <MetricsRow metrics={effectiveCompanyData.metrics} />

          {isCvmAnalysis ? (
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
          ) : financialSource === "cvm" && cvmFinancials && cvmFinancials.length > 0 ? (
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
            </div>
          ) : (
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
          )}

          <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

          <div style={{ padding: "18px 24px" }}>

            {/* ── Visão Geral ───────────────────────────────────────────── */}
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

            {/* ── Financeiros ───────────────────────────────────────────── */}
            {activeTab === "Financeiros" && (
              <div style={{ maxWidth: 900 }}>
                {/* Source toggle — only for mock companies */}
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
                  <DataSourceNotice
                    sourceMode="cvm_analysis"
                    quoteSource={marketQuote?.source ?? null}
                  />
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

            {/* ── Indicadores ───────────────────────────────────────────── */}
            {activeTab === "Indicadores" && (
              <div style={{ maxWidth: 760 }}>
                <FundamentalIndicators
                  financials={indicatorFinancials}
                  marketQuote={marketQuote}
                />
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

            {/* ── Comparáveis ───────────────────────────────────────────── */}
            {activeTab === "Comparáveis" && (
              <div style={{ maxWidth: 760 }}>
                <MultiplesTable data={effectiveCompanyData.multiples} />
                {effectiveCompanyData.multiples.length === 0 && (
                  <div style={{
                    background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10,
                    padding: "36px 24px", fontSize: 13, color: "#94a3b8",
                    textAlign: "center" as const,
                  }}>
                    Comparáveis setoriais não disponíveis para este ativo.
                  </div>
                )}
              </div>
            )}

            {/* ── Notícias e documentos ─────────────────────────────────── */}
            {activeTab === "Notícias e documentos" && (
              <div style={{ maxWidth: 700 }}>
                <DocumentsPanel ticker={selectedTicker} />
              </div>
            )}

          </div>
        </>
      ) : showCvmLoading ? (
        <CvmLoadingView ticker={selectedTicker} />
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
