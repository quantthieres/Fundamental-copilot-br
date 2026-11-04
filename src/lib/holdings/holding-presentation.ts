// Portuguese labels and formatters for the holding analysis UI (dashboard panel
// and report). Client-safe, pure.
//
// Nulls are never rendered as zero: every formatter returns "N/D" for null.
// Negative values carry an explicit minus sign (color is never the only cue).

import type { HoldingIndicator, PortfolioValueBasis } from "./holding-types";
import type { HoldingAnalysisAvailable } from "./holding-analysis";

export const ND = "N/D";
export const NOT_APPLICABLE = "Não aplicável";

const MINUS = "−";

function fixedPt(v: number, digits: number): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** BRL value scaled to bi/mi (input in reais). */
export function formatBRL(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return ND;
  const sign = v < 0 ? MINUS : "";
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${sign}R$ ${fixedPt(abs / 1e9, 2)} bi`;
  if (abs >= 1e6) return `${sign}R$ ${fixedPt(abs / 1e6, 1)} mi`;
  if (abs === 0) return "R$ 0";
  return `${sign}R$ ${fixedPt(abs / 1e3, 1)} mil`;
}

/** BRL value in millions with full precision of the published unit (e.g. "R$ 10.131,3 mi"). */
export function formatBRLMillions(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return ND;
  const sign = v < 0 ? MINUS : "";
  return `${sign}R$ ${fixedPt(Math.abs(v) / 1e6, digits)} mi`;
}

export function formatPrice(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return ND;
  return `R$ ${fixedPt(v, 2)}`;
}

/** Fraction → percentage ("0.182" → "18,2%"); signed values keep their sign. */
export function formatPct(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return ND;
  return `${v < 0 ? MINUS : ""}${fixedPt(Math.abs(v) * 100, digits)}%`;
}

/** Published ownership at its own precision: 0.375 → "37,5%", 0.0384 → "3,84%". */
export function formatOwnership(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return ND;
  const tenths = v * 1000;
  return formatPct(v, Math.abs(tenths - Math.round(tenths)) < 1e-6 ? 1 : 2);
}

export function formatMultiple(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return ND;
  return `${v < 0 ? MINUS : ""}${fixedPt(Math.abs(v), digits)}×`;
}

export function formatShares(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return ND;
  return Math.round(v).toLocaleString("pt-BR");
}

/** ISO date → dd/mm/aaaa. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return ND;
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

export const VALUE_BASIS_LABEL: Readonly<Record<PortfolioValueBasis, string>> = {
  market_price: "Preço de mercado",
  transaction_price: "Preço de transação",
  book_value: "Valor contábil",
  booked_fair_value: "Valor justo contabilizado",
  mixed_transaction_and_book: "Base mista (transação + contábil)",
  other_assets_liabilities: "Outros ativos e passivos (reconciliação)",
  net_cash: "Caixa líquido publicado",
  unclassified: "Base não classificada",
};

export const SOURCE_LABEL = {
  itausa_portfolio_page: "Itaúsa RI — Valor do Portfólio e Desconto",
  bradespar_boletim_quinzenal: "Bradespar RI — Boletim Quinzenal",
} as const;

export const MARKET_VALUE_METHOD_LABEL = {
  most_liquid_class_price_times_total_ex_treasury_shares:
    "Preço da classe mais líquida × total de ações (ON + PN) ex-tesouraria",
  class_price_times_class_shares_sum:
    "Soma por classe: preço de fechamento × ações da classe ex-tesouraria",
} as const;

/** Statement document label, e.g. "ITR 2T26" / "DFP 2025". */
export function statementLabel(s: { document: "DFP" | "ITR"; fiscalYear: number; quarter: number }): string {
  return s.document === "DFP" ? `DFP ${s.fiscalYear}` : `ITR ${s.quarter}T${String(s.fiscalYear).slice(2)}`;
}

/** "12 meses até dd/mm/aaaa" for a TTM indicator (first asOf = latest period). */
export function ttmNote(ind: HoldingIndicator): string {
  return ind.asOf[0] ? `12 meses até ${formatDate(ind.asOf[0])}` : ND;
}

/** Not-applicable reason for debt-based ratios of a holding without borrowings. */
export function noDebtReason(data: HoldingAnalysisAvailable): string | null {
  return data.indicators.core.grossDebt.value === 0 ? "sem empréstimos e financiamentos" : null;
}

/** "Holding com caixa líquido" when the statement net debt is negative. */
export function netDebtCaption(v: number | null): string {
  if (v === null) return ND;
  return v < 0 ? "Negativa = caixa líquido" : "Dívida bruta − caixa";
}
