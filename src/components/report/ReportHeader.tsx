import React from "react";
import type { CompanyProfile } from "@/data/companies/types";

interface Props {
  company: CompanyProfile;
  source: "mock" | "cvm";
  quoteSource: "brapi" | "mock" | null;
  generatedAt: string;
}

export default function ReportHeader({ company, source, quoteSource, generatedAt }: Props) {
  const financialsLabel = source === "cvm"
    ? "CVM · DFP anual consolidada"
    : "Dados ilustrativos";
  const quoteLabel = quoteSource === "brapi" ? "brapi (tempo real)" : "ilustrativa";

  return (
    <div style={{ marginBottom: 28 }}>
      {/* Brand + meta */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#2563eb", letterSpacing: "-0.3px", marginBottom: 2 }}>
            Fundamental Copilot BR
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>Relatório fundamentalista · Uso educacional e demonstrativo</div>
        </div>
        <div style={{ textAlign: "right", fontSize: 11, color: "#64748b", lineHeight: 1.7 }}>
          <div>Gerado em {generatedAt}</div>
          <div>Financeiros: <strong style={{ fontWeight: 600, color: "#374151" }}>{financialsLabel}</strong></div>
          <div>Cotação: <strong style={{ fontWeight: 600, color: "#374151" }}>{quoteLabel}</strong></div>
        </div>
      </div>

      {/* Company identity */}
      <div style={{ borderTop: "2px solid #0f172a", paddingTop: 18, display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 10, background: "#1e40af", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontWeight: 800, fontSize: 15, letterSpacing: "-0.5px",
        }}>
          {company.ticker.slice(0, 3)}
        </div>
        <div>
          <h1 style={{ margin: "0 0 5px", fontSize: 24, fontWeight: 700, color: "#0f172a", letterSpacing: "-0.5px" }}>
            {company.name}
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{
              fontSize: 11, color: "#475569", background: "#f1f5f9",
              padding: "2px 8px", borderRadius: 4, fontFamily: "'JetBrains Mono', monospace",
            }}>
              {company.exchange}: {company.ticker}
            </span>
            <span style={{ fontSize: 11, color: "#64748b" }}>{company.sector}</span>
            <span style={{ fontSize: 11, color: "#64748b" }}>·</span>
            <span style={{ fontSize: 11, color: "#64748b" }}>{company.currency}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
