import React from "react";
import Link from "next/link";
import ReportPrintButton from "./ReportPrintButton";
import ReportCopyLinkButton from "./ReportCopyLinkButton";

const PRINT_CSS = `
  @media print {
    .no-print { display: none !important; }

    body {
      background: #fff !important;
      margin: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .report-outer {
      background: #fff !important;
      padding: 0 !important;
      min-height: unset !important;
    }

    .report-page {
      box-shadow: none !important;
      border-radius: 0 !important;
      max-width: 100% !important;
      padding: 0 !important;
      margin: 0 !important;
    }

    .report-section {
      break-inside: avoid;
      page-break-inside: avoid;
      border-radius: 0 !important;
    }

    .report-table-wrap {
      overflow: visible !important;
    }

    table {
      break-inside: avoid;
      page-break-inside: avoid;
      width: 100% !important;
    }

    th, td {
      color: #000 !important;
    }

    a {
      color: #000 !important;
      text-decoration: none !important;
    }
  }

  @page { size: A4; margin: 18mm 14mm; }
`;

interface Props {
  ticker:       string;
  modelLabel:   string;
  sourceLabel?: string;
  children:     React.ReactNode;
}

export default function ReportShell({ ticker, modelLabel, sourceLabel, children }: Props) {
  const generatedAt = new Date().toLocaleString("pt-BR", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <div className="report-outer" style={{ minHeight: "100vh", background: "#f0f2f5", padding: "24px 16px" }}>

        {/* ── Top bar (hidden in print) ── */}
        <div className="no-print" style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          maxWidth: 900, margin: "0 auto 20px",
        }}>
          <Link
            href={`/dashboard?ticker=${encodeURIComponent(ticker)}`}
            style={{ fontSize: 12, color: "#2563eb", textDecoration: "none", fontWeight: 500 }}
          >
            ← Voltar ao Dashboard
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {sourceLabel && (
              <span style={{ fontSize: 11, color: "#94a3b8" }}>{sourceLabel}</span>
            )}
            <ReportCopyLinkButton />
            <ReportPrintButton />
          </div>
        </div>

        {/* ── Report body ── */}
        <div className="report-page" style={{
          maxWidth: 900, margin: "0 auto", background: "#fff",
          borderRadius: 10, padding: "36px 44px",
          boxShadow: "0 1px 8px rgba(0,0,0,0.08)",
        }}>

          {/* Brand header — visible in print */}
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "flex-start",
            marginBottom: 18,
          }}>
            <div>
              <div style={{
                fontSize: 14, fontWeight: 700, color: "#2563eb",
                letterSpacing: "-0.3px", marginBottom: 2,
              }}>
                Fundamental Copilot BR
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>
                {modelLabel} · Uso educacional e demonstrativo
              </div>
            </div>
            <div style={{ textAlign: "right", fontSize: 11, color: "#64748b", lineHeight: 1.8 }}>
              <div>Gerado em {generatedAt}</div>
              {sourceLabel && (
                <div>Fonte: <strong style={{ fontWeight: 600, color: "#374151" }}>{sourceLabel}</strong></div>
              )}
              <div style={{ color: "#94a3b8" }}>Finalidade: educacional e informativa</div>
            </div>
          </div>

          {children}

          {/* Shared legal disclaimer — always visible including in print */}
          <div style={{
            marginTop: 24, paddingTop: 16, borderTop: "1px solid #e2e8f0",
            fontSize: 11, color: "#94a3b8", lineHeight: 1.8,
          }}>
            <strong style={{ display: "block", marginBottom: 3, color: "#64748b", fontWeight: 600 }}>
              Aviso Legal
            </strong>
            Este relatório tem finalidade educacional e demonstrativa. As informações não constituem
            recomendação de investimento, oferta de compra ou venda de valores mobiliários, nem
            substituem análise profissional independente.
          </div>
        </div>
      </div>
    </>
  );
}
