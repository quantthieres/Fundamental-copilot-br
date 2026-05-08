import React from "react";
import NavBar from "@/components/dashboard/NavBar";
import CoverageTable from "@/components/coverage/CoverageTable";
import { B3_UNIVERSE } from "@/data/b3-universe";
import { COVERAGE_BADGE, COVERAGE_DESCRIPTION, type CoverageStatus } from "@/data/coverage-types";

// ─── Status counts ────────────────────────────────────────────────────────────

const STATUSES: CoverageStatus[] = [
  "full_analysis",
  "cvm_analysis",
  "cvm_financials",
  "quote_only",
  "sector_specific_model_required",
  "unavailable",
];

function countByStatus(): Record<CoverageStatus, number> {
  const counts = Object.fromEntries(STATUSES.map(s => [s, 0])) as Record<CoverageStatus, number>;
  for (const asset of B3_UNIVERSE) counts[asset.coverageStatus]++;
  return counts;
}

const STATUS_DESCRIPTIONS: Record<CoverageStatus, string> = {
  full_analysis:
    "Dashboard completo com dados financeiros, indicadores fundamentalistas, diagnóstico e métricas de mercado.",
  cvm_analysis:
    "Análise fundamentalista gerada automaticamente com dados CVM consolidados da DFP anual.",
  cvm_financials:
    "Dados CVM disponíveis, mas ainda sem histórico ou normalização suficiente para análise completa.",
  quote_only:
    "Cotação de mercado disponível via brapi. Dados fundamentalistas ainda não processados.",
  sector_specific_model_required:
    "Ativo exige metodologia própria (bancos, FIIs, seguradoras, ETFs). O modelo fundamentalista padrão não se aplica.",
  unavailable:
    "Ativo ainda sem cobertura confiável nesta versão. Será adicionado gradualmente.",
};

// ─── Layout primitives ────────────────────────────────────────────────────────

function Section({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ marginBottom: 32, ...style }}>{children}</div>;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
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

function Prose({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ margin: "0 0 10px", fontSize: 14, color: "#374151", lineHeight: 1.75 }}>
      {children}
    </p>
  );
}

// ─── Summary card ─────────────────────────────────────────────────────────────

function SummaryCard({ status, count }: { status: CoverageStatus; count: number }) {
  const badge = COVERAGE_BADGE[status];
  return (
    <div style={{
      background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10,
      padding: "16px 20px", display: "flex", flexDirection: "column", gap: 8,
    }}>
      <span style={{
        display: "inline-block",
        fontSize: 10, fontWeight: 700, padding: "2px 8px",
        borderRadius: 4, letterSpacing: "0.3px",
        background: badge.bg, color: badge.color,
        alignSelf: "flex-start",
      }}>
        {badge.label}
      </span>
      <div style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", lineHeight: 1 }}>
        {count}
      </div>
      <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>
        {COVERAGE_DESCRIPTION[status]}
      </div>
    </div>
  );
}

// ─── Status explanation row ───────────────────────────────────────────────────

function StatusRow({ status }: { status: CoverageStatus }) {
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
        minWidth: 90, textAlign: "center",
      }}>
        {badge.label}
      </span>
      <p style={{ margin: 0, fontSize: 13, color: "#374151", lineHeight: 1.65 }}>
        {STATUS_DESCRIPTIONS[status]}
      </p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CoberturaPaged() {
  const counts = countByStatus();
  const total  = B3_UNIVERSE.length;

  return (
    <div style={{ background: "#f8fafc", minHeight: "100vh", fontFamily: "inherit" }}>
      <NavBar />

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "36px 24px 64px" }}>

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
            margin: "0 0 10px", fontSize: 26, fontWeight: 800,
            color: "#0f172a", letterSpacing: "-0.5px", lineHeight: 1.2,
          }}>
            Cobertura da B3
          </h1>
          <p style={{ margin: "0 0 10px", fontSize: 15, color: "#475569", lineHeight: 1.7, maxWidth: 640 }}>
            Veja quais ativos já possuem análise fundamentalista, dados CVM, cotação ou exigem metodologia específica.
          </p>
          <p style={{ margin: 0, fontSize: 13, color: "#64748b", lineHeight: 1.7, maxWidth: 640 }}>
            A cobertura é expandida gradualmente. O sistema separa ativos por nível de suporte
            para evitar aplicar modelos inadequados a setores que requerem metodologia própria.
          </p>
        </Section>

        {/* ── Summary cards ── */}
        <Section>
          <SectionLabel>Resumo · {total} ativos</SectionLabel>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
            gap: 12,
          }}>
            {STATUSES.map(s => (
              <SummaryCard key={s} status={s} count={counts[s]} />
            ))}
          </div>
        </Section>

        {/* ── Coverage table ── */}
        <Section>
          <SectionLabel>Ativos · B3 Universe</SectionLabel>
          <Card style={{ padding: "18px 20px" }}>
            <CoverageTable assets={B3_UNIVERSE} />
          </Card>
        </Section>

        {/* ── Status explanations ── */}
        <Section>
          <SectionLabel>O que significa cada status</SectionLabel>
          <Card style={{ padding: "0 24px" }}>
            {STATUSES.map((s, i) => (
              <div
                key={s}
                style={i === STATUSES.length - 1 ? { borderBottom: "none" } : {}}
              >
                <StatusRow status={s} />
              </div>
            ))}
          </Card>
        </Section>

        {/* ── Disclaimer ── */}
        <div style={{
          background: "#fff", border: "1px solid #fde68a",
          borderRadius: 8, padding: "12px 18px",
        }}>
          <Prose>
            <strong style={{ color: "#92400e" }}>Aviso: </strong>
            A cobertura e os dados apresentados têm finalidade educacional e demonstrativa.
            A disponibilidade de dados não representa recomendação de investimento.
          </Prose>
        </div>

      </main>
    </div>
  );
}
