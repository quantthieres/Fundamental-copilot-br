import React from "react";
import AppHeader from "@/components/layout/AppHeader";
import CoverageTable from "@/components/coverage/CoverageTable";
import { B3_UNIVERSE } from "@/data/b3-universe";
import { COVERAGE_BADGE, type CoverageStatus } from "@/data/coverage-types";
import { BANK_BADGE, BANK_CACHE_COUNT, hasBankAnalysisCache } from "@/lib/banks/bank-coverage";
import { FII_BADGE, FII_CACHE_COUNT, hasFiiAnalysisCache } from "@/lib/fiis/fii-coverage";
import { INSURANCE_BADGE, INSURANCE_CACHE_COUNT, hasInsuranceAnalysisCache } from "@/lib/insurance/insurance-coverage";
import { classifyB3Asset } from "@/lib/coverage/cobertura-helpers";

const INFORMATIONAL_BADGE = { label: "Informativo", bg: "#e0f2fe", color: "#0369a1" };

// ── Counts ────────────────────────────────────────────────────────────────────

function countByStatus(): Record<CoverageStatus, number> {
  const zero = () => 0;
  const counts: Record<CoverageStatus, number> = {
    full_analysis:                  zero(),
    cvm_analysis:                   zero(),
    cvm_financials:                 zero(),
    quote_only:                     zero(),
    sector_specific_model_required: zero(),
    unavailable:                    zero(),
  };
  for (const a of B3_UNIVERSE) counts[a.coverageStatus]++;
  return counts;
}

// Assets with the informational layer (ETFs, BDRs, funds).
function countInformational(): number {
  return B3_UNIVERSE.filter(a => {
    const t = classifyB3Asset(a);
    return (t === "etf" || t === "bdr" || t === "fund") && a.coverageStatus !== "unavailable";
  }).length;
}

// Sector-specific assets that do not yet have an implemented specific model.
// Excludes bank, FII, insurance tickers with cache AND ETF/BDR/fund (now informational).
function countSectorSpecificPending(): number {
  return B3_UNIVERSE.filter(a => {
    if (a.coverageStatus !== "sector_specific_model_required") return false;
    const t = classifyB3Asset(a);
    if (t === "bank"      && hasBankAnalysisCache(a.ticker))      return false;
    if (t === "fii"       && hasFiiAnalysisCache(a.ticker))       return false;
    if (t === "insurance" && hasInsuranceAnalysisCache(a.ticker)) return false;
    if (t === "etf" || t === "bdr" || t === "fund")               return false;
    return true;
  }).length;
}

// ── Layout primitives ─────────────────────────────────────────────────────────

function Section({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ marginBottom: 36, ...style }}>{children}</div>;
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, letterSpacing: "0.8px",
      textTransform: "uppercase", color: "#94a3b8", marginBottom: 12,
    }}>
      {children}
    </div>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10,
      padding: "20px 24px", ...style,
    }}>
      {children}
    </div>
  );
}

// ── Summary card ──────────────────────────────────────────────────────────────

interface SummaryItem {
  badge: { label: string; bg: string; color: string };
  count: number;
  desc: string;
}

function SummaryCard({ badge, count, desc }: SummaryItem) {
  return (
    <div style={{
      background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10,
      padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10,
    }}>
      <span style={{
        display: "inline-block", alignSelf: "flex-start",
        fontSize: 10, fontWeight: 700, padding: "2px 8px",
        borderRadius: 4, letterSpacing: "0.3px",
        background: badge.bg, color: badge.color,
      }}>
        {badge.label}
      </span>
      <div style={{ fontSize: 30, fontWeight: 800, color: "#0f172a", lineHeight: 1 }}>
        {count}
      </div>
      <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
        {desc}
      </div>
    </div>
  );
}

// ── Status explanation row ────────────────────────────────────────────────────

const STATUS_EXPLANATIONS: { status: CoverageStatus; desc: string }[] = [
  {
    status: "full_analysis",
    desc:   "Dashboard completo com dados financeiros históricos, indicadores fundamentalistas, diagnóstico e métricas de mercado.",
  },
  {
    status: "cvm_analysis",
    desc:   "Análise fundamentalista gerada automaticamente a partir dos dados CVM da DFP anual. Cobertura sólida para a maioria dos indicadores.",
  },
  {
    status: "cvm_financials",
    desc:   "Dados financeiros da CVM disponíveis, mas histórico ainda insuficiente para análise completa. Em expansão.",
  },
  {
    status: "quote_only",
    desc:   "Cotação de mercado disponível. Demonstrações financeiras CVM ainda não integradas para este ativo.",
  },
  {
    status: "sector_specific_model_required",
    desc:   "Bancos, seguradoras, FIIs, ETFs e BDRs exigem metodologia específica. O modelo fundamentalista industrial padrão não se aplica.",
  },
  {
    status: "unavailable",
    desc:   "Ativo reconhecido no universo B3, mas ainda sem cobertura de dados financeiros nesta versão.",
  },
];

function StatusRow({ status, desc }: { status: CoverageStatus; desc: string }) {
  const badge = COVERAGE_BADGE[status];
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 14,
      padding: "14px 0", borderBottom: "1px solid #f1f5f9",
    }}>
      <span style={{
        display: "inline-block", flexShrink: 0,
        fontSize: 10, fontWeight: 700, padding: "3px 9px",
        borderRadius: 4, letterSpacing: "0.3px",
        background: badge.bg, color: badge.color, marginTop: 2,
        minWidth: 96, textAlign: "center",
      }}>
        {badge.label}
      </span>
      <p style={{ margin: 0, fontSize: 13, color: "#374151", lineHeight: 1.65 }}>
        {desc}
      </p>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CoberturaPage() {
  const counts = countByStatus();
  const total  = B3_UNIVERSE.length;
  const sectorSpecificCount  = countSectorSpecificPending();
  const informationalCount   = countInformational();

  const summaryCards: SummaryItem[] = [
    {
      badge: COVERAGE_BADGE.full_analysis,
      count: counts.full_analysis,
      desc:  "Dashboard completo com indicadores financeiros e diagnóstico fundamentalista.",
    },
    {
      badge: { label: "Dados CVM", bg: "#ede9fe", color: "#7c3aed" },
      count: counts.cvm_analysis + counts.cvm_financials,
      desc:  "Dados CVM disponíveis, com profundidade variável de análise fundamentalista.",
    },
    {
      badge: COVERAGE_BADGE.quote_only,
      count: counts.quote_only,
      desc:  "Apenas dados de mercado disponíveis. Financeiros CVM ainda não processados.",
    },
    {
      badge: INFORMATIONAL_BADGE,
      count: informationalCount,
      desc:  "ETFs e BDRs com camada informativa — sem análise fundamentalista corporativa.",
    },
    {
      badge: COVERAGE_BADGE.sector_specific_model_required,
      count: sectorSpecificCount,
      desc:  "Holdings financeiras e demais ativos sem modelo específico implementado.",
    },
    {
      badge: BANK_BADGE,
      count: BANK_CACHE_COUNT,
      desc:  "Bancos com modelo bancário inicial disponível — indicadores específicos de instituições financeiras baseados em dados CVM.",
    },
    {
      badge: FII_BADGE,
      count: FII_CACHE_COUNT,
      desc:  "FIIs com modelo inicial disponível — patrimônio e rendimentos mensais baseados no informe mensal CVM.",
    },
    {
      badge: INSURANCE_BADGE,
      count: INSURANCE_CACHE_COUNT,
      desc:  "Seguradoras com modelo inicial disponível — indicadores anuais baseados na DFP CVM.",
    },
  ];

  return (
    <div style={{ background: "#f8fafc", minHeight: "100vh", fontFamily: "inherit" }}>
      <AppHeader />

      <main style={{ maxWidth: 1160, margin: "0 auto", padding: "36px 24px 72px" }}>

        {/* ── Hero ── */}
        <Section>
          <div style={{ marginBottom: 6 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: "0.8px",
              textTransform: "uppercase", color: "#6366f1",
            }}>
              Transparência
            </span>
          </div>
          <h1 style={{
            margin: "0 0 14px", fontSize: 26, fontWeight: 800,
            color: "#0f172a", letterSpacing: "-0.5px", lineHeight: 1.2,
          }}>
            Cobertura de ativos
          </h1>
          <p style={{ margin: "0 0 10px", fontSize: 15, color: "#475569", lineHeight: 1.7, maxWidth: 680 }}>
            A plataforma suporta diferentes profundidades de análise conforme o tipo de ativo
            e a disponibilidade de dados CVM. Empresas operacionais com dados CVM consolidados
            podem receber análise fundamentalista completa.
          </p>
          <p style={{ margin: 0, fontSize: 13, color: "#64748b", lineHeight: 1.7, maxWidth: 680 }}>
            Bancos, seguradoras, FIIs, ETFs e BDRs requerem modelos específicos e não são
            enquadrados no modelo industrial padrão. Um modelo bancário inicial está disponível
            para os principais bancos listados na B3, com indicadores específicos baseados em
            dados CVM. A cobertura é expandida gradualmente.
          </p>
        </Section>

        {/* ── Summary cards ── */}
        <Section>
          <Label>Resumo · {total} ativos no universo</Label>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
            gap: 12,
          }}>
            {summaryCards.map(card => (
              <SummaryCard key={card.badge.label} {...card} />
            ))}
          </div>
        </Section>

        {/* ── Coverage table ── */}
        <Section>
          <Label>Ativos · B3 Universe</Label>
          <Card style={{ padding: "18px 20px" }}>
            <CoverageTable assets={B3_UNIVERSE} />
          </Card>
        </Section>

        {/* ── Status explanations ── */}
        <Section>
          <Label>O que significa cada nível de cobertura</Label>
          <Card style={{ padding: "0 24px" }}>
            {STATUS_EXPLANATIONS.map((row, i) => (
              <div
                key={row.status}
                style={i === STATUS_EXPLANATIONS.length - 1 ? { borderBottom: "none" } : {}}
              >
                <StatusRow status={row.status} desc={row.desc} />
              </div>
            ))}
          </Card>
        </Section>

        {/* ── Sector-specific note ── */}
        <Section style={{ marginBottom: 0 }}>
          <Label>Ativos com modelo específico</Label>
          <Card>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
              {[
                { label: "Bancos",       desc: "Modelo bancário inicial disponível para os principais bancos. Indicadores específicos de instituições financeiras baseados em dados CVM." },
                { label: "Seguradoras",  desc: "Modelo específico para seguradoras." },
                { label: "FIIs",         desc: "Modelo de FII com patrimônio e rendimentos mensais baseados no informe mensal CVM. Indicadores industriais não se aplicam." },
                { label: "ETFs",         desc: "Fundo/índice listado em bolsa — exibição informativa disponível. Não utiliza demonstrações corporativas tradicionais." },
                { label: "BDRs",         desc: "Recibo de ativo estrangeiro — exibição informativa disponível. A empresa subjacente não reporta pela estrutura CVM brasileira." },
              ].map(item => (
                <div key={item.label} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{
                    flexShrink: 0, fontSize: 10, fontWeight: 700,
                    padding: "3px 8px", borderRadius: 4,
                    background: COVERAGE_BADGE.sector_specific_model_required.bg,
                    color: COVERAGE_BADGE.sector_specific_model_required.color,
                    marginTop: 1, letterSpacing: "0.2px",
                  }}>
                    {item.label}
                  </span>
                  <p style={{ margin: 0, fontSize: 13, color: "#475569", lineHeight: 1.55 }}>
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </Section>

      </main>
    </div>
  );
}
