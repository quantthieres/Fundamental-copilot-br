"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import type { B3Asset } from "@/data/b3-universe";
import type { CoverageStatus } from "@/data/coverage-types";
import { COVERAGE_BADGE } from "@/data/coverage-types";
import {
  classifyB3Asset,
  getAssetTypeLabel,
  getCoverageReason,
  type RichAssetType,
} from "@/lib/coverage/cobertura-helpers";
import { hasBankAnalysisCache, BANK_BADGE } from "@/lib/banks/bank-coverage";

// ── Filter option types ───────────────────────────────────────────────────────

type TypeFilter = "" | "stock" | "unit" | "bank" | "insurance" | "financial" | "fii" | "etf" | "bdr";

const STATUS_OPTIONS: { value: CoverageStatus | ""; label: string }[] = [
  { value: "",                              label: "Todos os status"        },
  { value: "full_analysis",                label: "Análise completa"       },
  { value: "cvm_analysis",                 label: "Análise CVM"            },
  { value: "cvm_financials",               label: "Dados CVM"              },
  { value: "quote_only",                   label: "Apenas cotação"         },
  { value: "sector_specific_model_required", label: "Modelo específico"    },
  { value: "unavailable",                  label: "Em breve"               },
];

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: "",          label: "Todos os tipos" },
  { value: "stock",     label: "Ações"          },
  { value: "unit",      label: "Units"          },
  { value: "bank",      label: "Bancos"         },
  { value: "insurance", label: "Seguradoras"    },
  { value: "financial", label: "Financeiro"     },
  { value: "fii",       label: "FIIs"           },
  { value: "etf",       label: "ETFs"           },
  { value: "bdr",       label: "BDRs"           },
];

function matchesTypeFilter(richType: RichAssetType, filter: TypeFilter): boolean {
  if (!filter) return true;
  if (filter === "stock") return richType === "common_stock" || richType === "preferred_stock";
  return richType === filter;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  assets: B3Asset[];
}

export default function CoverageTable({ assets }: Props) {
  const [query,        setQuery]        = useState("");
  const [statusFilter, setStatusFilter] = useState<CoverageStatus | "">("");
  const [typeFilter,   setTypeFilter]   = useState<TypeFilter>("");

  // Pre-classify every asset once per render cycle.
  const classified = useMemo(
    () => assets.map(a => ({
      asset:    a,
      richType: classifyB3Asset(a),
      reason:   getCoverageReason(a),
    })),
    [assets],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return classified.filter(({ asset, richType }) => {
      if (statusFilter && asset.coverageStatus !== statusFilter) return false;
      if (!matchesTypeFilter(richType, typeFilter))               return false;
      if (!q) return true;
      return (
        asset.ticker.toLowerCase().includes(q)      ||
        asset.companyName.toLowerCase().includes(q) ||
        asset.tradingName.toLowerCase().includes(q) ||
        asset.sector.toLowerCase().includes(q)
      );
    });
  }, [classified, query, statusFilter, typeFilter]);

  return (
    <div>
      {/* ── Filters ── */}
      <div style={S.filterRow}>
        <div style={S.searchWrap}>
          <svg style={S.searchIcon} width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="6.5" cy="6.5" r="5" stroke="#94a3b8" strokeWidth="1.5"/>
            <path d="M10.5 10.5L14 14" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            style={S.searchInput}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por ticker, empresa ou setor…"
          />
          {query && (
            <button onClick={() => setQuery("")} style={S.clearBtn} aria-label="Limpar">×</button>
          )}
        </div>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as CoverageStatus | "")}
          style={S.select}
        >
          {STATUS_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value as TypeFilter)}
          style={S.select}
        >
          {TYPE_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <span style={S.count}>{filtered.length} ativo{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* ── Table ── */}
      <div style={S.tableWrap}>
        <table style={S.table}>
          <thead>
            <tr style={S.headerRow}>
              <th style={{ ...S.th, width: 80 }}>Ticker</th>
              <th style={S.th}>Empresa</th>
              <th style={{ ...S.th, width: 68 }}>Tipo</th>
              <th style={{ ...S.th, width: 128 }}>Status</th>
              <th style={S.th}>Motivo / observação</th>
              <th style={{ ...S.th, width: 52 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} style={S.emptyCell}>Nenhum ativo encontrado.</td>
              </tr>
            ) : (
              filtered.map(({ asset, richType, reason }) => {
                const isBankCached = richType === "bank" && hasBankAnalysisCache(asset.ticker);
                const badge = isBankCached ? BANK_BADGE : COVERAGE_BADGE[asset.coverageStatus];
                const isDashboardLinked = asset.coverageStatus === "full_analysis" ||
                  asset.coverageStatus === "cvm_analysis" ||
                  asset.coverageStatus === "cvm_financials" ||
                  isBankCached;
                return (
                  <tr key={asset.ticker} style={S.row}>
                    <td style={S.tickerCell}>
                      {isDashboardLinked ? (
                        <Link
                          href={`/dashboard?ticker=${encodeURIComponent(asset.ticker)}`}
                          style={S.tickerLink}
                        >
                          {asset.ticker}
                        </Link>
                      ) : (
                        asset.ticker
                      )}
                    </td>
                    <td style={S.nameCell}>
                      <span style={S.tradingName}>{asset.tradingName}</span>
                      {asset.companyName !== asset.tradingName && (
                        <span style={S.companyName}>{asset.companyName}</span>
                      )}
                    </td>
                    <td style={S.badgeCell}>
                      <span style={S.typeBadge}>{getAssetTypeLabel(richType)}</span>
                    </td>
                    <td style={S.badgeCell}>
                      <span style={{ ...S.statusBadge, background: badge.bg, color: badge.color }}>
                        {badge.label}
                      </span>
                    </td>
                    <td style={S.reasonCell}>
                      {reason}
                    </td>
                    <td style={S.actionCell}>
                      {isDashboardLinked && (
                        <Link
                          href={`/dashboard?ticker=${encodeURIComponent(asset.ticker)}`}
                          style={S.dashLink}
                          title={`Abrir dashboard — ${asset.ticker}`}
                        >
                          →
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  filterRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
    flexWrap: "wrap",
  },
  searchWrap: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 7,
    padding: "0 12px",
    height: 36,
    flex: 1,
    minWidth: 220,
    position: "relative",
  },
  searchIcon: { flexShrink: 0 },
  searchInput: {
    background: "none",
    border: "none",
    outline: "none",
    fontSize: 13,
    color: "#334155",
    flex: 1,
    fontFamily: "inherit",
  },
  clearBtn: {
    background: "none",
    border: "none",
    color: "#94a3b8",
    fontSize: 18,
    cursor: "pointer",
    padding: "0 2px",
    lineHeight: 1,
    flexShrink: 0,
    fontFamily: "inherit",
  },
  select: {
    height: 36,
    padding: "0 10px",
    fontSize: 13,
    border: "1px solid #e2e8f0",
    borderRadius: 7,
    background: "#f8fafc",
    color: "#374151",
    outline: "none",
    cursor: "pointer",
    fontFamily: "inherit",
    flexShrink: 0,
  },
  count: {
    fontSize: 12,
    color: "#94a3b8",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  tableWrap: {
    overflowX: "auto",
    borderRadius: 8,
    border: "1px solid #e2e8f0",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
  },
  headerRow: {
    background: "#f8fafc",
    borderBottom: "1px solid #e2e8f0",
  },
  th: {
    padding: "9px 14px",
    textAlign: "left",
    fontSize: 11,
    fontWeight: 700,
    color: "#64748b",
    letterSpacing: "0.4px",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  },
  row: {
    borderBottom: "1px solid #f1f5f9",
  },
  tickerCell: {
    padding: "9px 14px",
    fontFamily: "'JetBrains Mono', 'Courier New', monospace",
    fontSize: 12,
    fontWeight: 700,
    color: "#0f172a",
    whiteSpace: "nowrap",
  },
  tickerLink: {
    color: "#2563eb",
    textDecoration: "none",
    fontFamily: "inherit",
    fontWeight: 700,
  },
  nameCell: {
    padding: "9px 14px",
    minWidth: 160,
  },
  tradingName: {
    display: "block",
    fontWeight: 600,
    color: "#1e293b",
    fontSize: 13,
  },
  companyName: {
    display: "block",
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 1,
  },
  badgeCell: {
    padding: "9px 14px",
    whiteSpace: "nowrap",
  },
  typeBadge: {
    display: "inline-block",
    fontSize: 10,
    fontWeight: 600,
    padding: "2px 7px",
    borderRadius: 4,
    background: "#f1f5f9",
    color: "#475569",
    letterSpacing: "0.2px",
  },
  statusBadge: {
    display: "inline-block",
    fontSize: 10,
    fontWeight: 600,
    padding: "2px 8px",
    borderRadius: 4,
    letterSpacing: "0.2px",
  },
  reasonCell: {
    padding: "9px 14px",
    fontSize: 12,
    color: "#64748b",
    maxWidth: 340,
    lineHeight: 1.45,
  },
  actionCell: {
    padding: "9px 10px",
    textAlign: "center",
    whiteSpace: "nowrap",
  },
  dashLink: {
    display: "inline-block",
    fontSize: 13,
    color: "#2563eb",
    textDecoration: "none",
    fontWeight: 600,
    padding: "1px 6px",
    borderRadius: 4,
    lineHeight: 1,
  },
  emptyCell: {
    padding: "32px 14px",
    textAlign: "center",
    color: "#94a3b8",
    fontSize: 13,
  },
};
