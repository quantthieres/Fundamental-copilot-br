import React from "react";
import type { MarketDataQuote } from "@/lib/market-data/types";

interface Company {
  name: string;
  ticker: string;
  exchange: string;
  sector: string;
  price: number;
  priceChangePct: number;
  marketCap: string;
  enterpriseValue: string;
  currency: string;
}

interface CompanyHeaderProps {
  company: Company;
  quote?: MarketDataQuote | null;
  quoteLoading?: boolean;
  exportUrl?: string;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function CompanyHeader({ company, quote, quoteLoading, exportUrl }: CompanyHeaderProps) {
  const displayPrice     = quote?.price         ?? company.price;
  const displayChangePct = quote?.changePercent  ?? company.priceChangePct;
  const isUp             = displayChangePct >= 0;
  const isLive           = quote?.source === "brapi";

  let sourceLabel = "Fonte: dados ilustrativos";
  if (isLive) {
    const time = quote?.updatedAt ? ` · Atualizado em ${formatTime(quote.updatedAt)}` : "";
    sourceLabel = `Fonte: brapi${time}`;
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.left}>
        <div style={styles.logoBox}>
          <div style={styles.tickerLogo}>{company.ticker.slice(0, 3)}</div>
        </div>
        <div>
          <div style={styles.nameRow}>
            <h1 style={styles.name}>{company.name}</h1>
            <span style={styles.exchange}>{company.exchange}: {company.ticker}</span>
            <span style={styles.sector}>{company.sector}</span>
          </div>
          <div style={styles.metaRow}>
            <span style={styles.metaItem}>Valor de Mercado <strong>{company.marketCap}</strong></span>
            <span style={styles.metaDivider}>/</span>
            <span style={styles.metaItem}>EV <strong>{company.enterpriseValue}</strong></span>
            <span style={styles.metaDivider}>/</span>
            <span style={styles.metaItem}>Moeda <strong>{company.currency}</strong></span>
          </div>
        </div>
      </div>
      <div style={styles.right}>
        <div style={styles.priceBlock}>
          <div style={styles.priceLabel}>
            Preço Atual
            {quoteLoading && (
              <span style={styles.loadingDots}>···</span>
            )}
          </div>
          <div style={styles.price}>
            R$ {displayPrice.toFixed(2).replace(".", ",")}
          </div>
          <div style={{ ...styles.priceChange, color: isUp ? "#16a34a" : "#dc2626" }}>
            {isUp ? "▲" : "▼"} {Math.abs(displayChangePct).toFixed(2).replace(".", ",")}% hoje
          </div>
          <div style={styles.sourceLabel}>{sourceLabel}</div>
        </div>
        <div style={styles.actions}>
          {exportUrl ? (
            <a href={exportUrl} style={{ ...styles.btnPrimary, textDecoration: "none" }}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ marginRight: 5 }}>
                <path d="M8 2v8M5 7l3 3 3-3M3 12h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Exportar Relatório
            </a>
          ) : (
            <button style={{ ...styles.btnPrimary, opacity: 0.5, cursor: "not-allowed" as const }}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ marginRight: 5 }}>
                <path d="M8 2v8M5 7l3 3 3-3M3 12h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Exportar Relatório
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "16px 24px", background: "#fff", borderBottom: "1px solid #e2e8f0",
    gap: 16,
  },
  left: { display: "flex", alignItems: "center", gap: 14 },
  logoBox: { flexShrink: 0 },
  tickerLogo: {
    width: 36, height: 36, borderRadius: 8, background: "#1e40af",
    display: "flex", alignItems: "center", justifyContent: "center",
    color: "#fff", fontWeight: 800, fontSize: 13, letterSpacing: "-0.5px",
  },
  nameRow: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 5 },
  name: { margin: 0, fontSize: 20, fontWeight: 700, color: "#0f172a", letterSpacing: "-0.5px" },
  exchange: {
    fontSize: 12, color: "#64748b", background: "#f1f5f9",
    padding: "2px 7px", borderRadius: 4, fontFamily: "'JetBrains Mono', monospace",
  },
  sector: {
    fontSize: 11, color: "#64748b", background: "#f8fafc",
    border: "1px solid #e2e8f0", padding: "2px 7px", borderRadius: 4,
  },
  metaRow: { display: "flex", alignItems: "center", gap: 6 },
  metaItem: { fontSize: 12, color: "#64748b" },
  metaDivider: { color: "#cbd5e1", fontSize: 11 },
  right: { display: "flex", alignItems: "center", gap: 20, flexShrink: 0 },
  priceBlock: { textAlign: "right" },
  priceLabel: {
    fontSize: 10, color: "#94a3b8", fontWeight: 500,
    textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 2,
    display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4,
  },
  loadingDots: { fontSize: 9, color: "#94a3b8", letterSpacing: "2px" },
  price: {
    fontSize: 26, fontWeight: 700, color: "#0f172a",
    fontFamily: "'JetBrains Mono', monospace", letterSpacing: "-1px",
  },
  priceChange: { fontSize: 12, fontWeight: 500, fontFamily: "'JetBrains Mono', monospace" },
  sourceLabel: { fontSize: 10, color: "#94a3b8", marginTop: 5, letterSpacing: "0.1px" },
  actions: { display: "flex", gap: 8 },
  btnPrimary: {
    display: "flex", alignItems: "center", fontSize: 12, fontWeight: 500,
    padding: "6px 12px", borderRadius: 7, border: "none",
    background: "#2563eb", cursor: "pointer", color: "#fff", fontFamily: "inherit",
  },
};
