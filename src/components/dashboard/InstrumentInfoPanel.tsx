"use client";

import type { InstrumentInfoResponse, InformationalInstrumentType } from "@/lib/instruments/instrument-types";
import { getInstrumentTypeLabel } from "@/lib/instruments/instrument-info";
import type { MarketDataQuote } from "@/lib/market-data/types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function panelTitle(type: InformationalInstrumentType): string {
  if (type === "etf") return "Informações do ETF";
  if (type === "bdr") return "Informações do BDR";
  return "Informações do ativo";
}

function bannerStyle(type: InformationalInstrumentType): React.CSSProperties {
  if (type === "etf") {
    return { background: "#f0f9ff", borderColor: "#bae6fd", badgeBackground: "#e0f2fe", badgeColor: "#0369a1" } as React.CSSProperties;
  }
  if (type === "bdr") {
    return { background: "#fdf4ff", borderColor: "#e9d5ff", badgeBackground: "#f3e8ff", badgeColor: "#7e22ce" } as React.CSSProperties;
  }
  return { background: "#f8fafc", borderColor: "#e2e8f0", badgeBackground: "#f1f5f9", badgeColor: "#475569" } as React.CSSProperties;
}

function bannerColors(type: InformationalInstrumentType): { bg: string; border: string; badgeBg: string; badgeColor: string; text: string } {
  if (type === "etf") return { bg: "#f0f9ff", border: "#bae6fd", badgeBg: "#e0f2fe", badgeColor: "#0369a1", text: "#0369a1" };
  if (type === "bdr") return { bg: "#fdf4ff", border: "#e9d5ff", badgeBg: "#f3e8ff", badgeColor: "#7e22ce", text: "#6b21a8" };
  return { bg: "#f8fafc", border: "#e2e8f0", badgeBg: "#f1f5f9", badgeColor: "#475569", text: "#64748b" };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoCard({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{
      background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10,
      padding: "16px 20px", display: "flex", flexDirection: "column", gap: 6,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase", color: "#94a3b8" }}>
        {label}
      </div>
      <div style={{
        fontSize: 14, fontWeight: 600, color: "#1e293b",
        fontFamily: mono ? "'JetBrains Mono', monospace" : "inherit",
      }}>
        {value}
      </div>
    </div>
  );
}

function QuoteBlock({ quote, quoteLoading }: { quote: MarketDataQuote | null; quoteLoading: boolean }) {
  if (quoteLoading) {
    return (
      <div style={{ padding: "12px 0", fontSize: 12, color: "#94a3b8" }}>
        Buscando cotação...
      </div>
    );
  }
  if (!quote || quote.price <= 0) return null;

  const isUp = (quote.changePercent ?? 0) >= 0;

  return (
    <div style={{
      background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10,
      padding: "16px 20px",
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: "#94a3b8", marginBottom: 6 }}>
        Cotação atual · Fonte: brapi
      </div>
      <div style={{
        fontSize: 28, fontWeight: 700, color: "#0f172a",
        fontFamily: "'JetBrains Mono', monospace", letterSpacing: "-1px",
      }}>
        {`R$ ${quote.price.toFixed(2).replace(".", ",")}`}
      </div>
      {quote.changePercent != null && (
        <div style={{
          fontSize: 13, fontWeight: 500, marginTop: 3,
          color: isUp ? "#16a34a" : "#dc2626",
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          {isUp ? "▲" : "▼"} {Math.abs(quote.changePercent).toFixed(2).replace(".", ",")}% hoje
        </div>
      )}
      {quote.marketCap && (
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
          Capitalização:{" "}
          <span style={{ fontWeight: 600, color: "#374151" }}>
            R$ {(quote.marketCap / 1_000_000_000).toFixed(1).replace(".", ",")}B
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  data: InstrumentInfoResponse;
  quote: MarketDataQuote | null;
  quoteLoading: boolean;
}

export default function InstrumentInfoPanel({ data, quote, quoteLoading }: Props) {
  const colors = bannerColors(data.instrumentType);
  void bannerStyle; // used only for reference above

  return (
    <div style={{ padding: "18px 24px", maxWidth: 900 }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: "#0f172a" }}>
          {panelTitle(data.instrumentType)}
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
          Camada informativa — sem análise fundamentalista corporativa
        </p>
      </div>

      {/* ── Info cards row ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
        gap: 12,
        marginBottom: 20,
      }}>
        <InfoCard label="Tipo do ativo"    value={getInstrumentTypeLabel(data.instrumentType)} />
        <InfoCard label="Dados de mercado" value={data.marketDataAvailable ? "Cotação disponível via brapi" : "Indisponível"} />
        <InfoCard label="Modelo aplicável" value="Camada informativa" />
      </div>

      {/* ── Quote ── */}
      <div style={{ marginBottom: 20 }}>
        <QuoteBlock quote={quote} quoteLoading={quoteLoading} />
      </div>

      {/* ── Description block ── */}
      <div style={{
        background: "#fff", border: `1px solid ${colors.border}`,
        borderRadius: 10, padding: "20px 24px", marginBottom: 16,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase", color: colors.badgeColor, marginBottom: 10 }}>
          Sobre este instrumento
        </div>
        <p style={{ margin: "0 0 14px", fontSize: 14, color: "#1e293b", lineHeight: 1.65 }}>
          {data.description}
        </p>
        <div style={{
          background: colors.bg, borderRadius: 7, padding: "12px 16px",
          borderLeft: `3px solid ${colors.border}`,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: colors.badgeColor, marginBottom: 6 }}>
            Por que não há análise fundamentalista
          </div>
          <p style={{ margin: 0, fontSize: 13, color: colors.text, lineHeight: 1.6 }}>
            {data.whyNoFundamentalAnalysis}
          </p>
        </div>
      </div>

      {/* ── Disclaimer ── */}
      <div style={{
        background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8,
        padding: "10px 16px", display: "flex", alignItems: "flex-start", gap: 10,
      }}>
        <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>⚠️</span>
        <p style={{ margin: 0, fontSize: 12, color: "#92400e", lineHeight: 1.55 }}>
          Esta tela tem finalidade informativa e não constitui recomendação de investimento.
        </p>
      </div>
    </div>
  );
}
