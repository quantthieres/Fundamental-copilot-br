// Verified identity and CVM account mapping of B3 S.A. — the only issuer of
// the market-infrastructure model (Phase 1). There is no sector-name rule:
// an issuer enters this model only by an entry in this file.
//
// Verified 2026-11-04 against:
//   - CVM cad_cia_aberta.csv (CD_CVM 21610, CNPJ, SIT=ATIVO, Categoria A);
//   - CVM FCA 2026 valor_mobiliario (B3SA3 is the only listed equity: ON,
//     Novo Mercado, quoted since 2008-08-20);
//   - B3 GetDetail (codeCVM 21610 → B3SA3, ISIN BRB3SAACNOR6);
//   - CVM composicao_capital 2026-06-30 (5,046,500,000 issued, 48,201,452
//     treasury — B3 files share counts in units, not thousands);
//   - DFP 2019–2025 and ITR 2019–2026 consolidated statements (the account
//     descriptions below are the verbatim DS_CONTA values seen).
//
// No @/ imports — also used by tsx scripts.

import type { RevenueSegmentId } from "./market-infrastructure-types";

/** An issuer-specific (ST_CONTA_FIXA = N) line: verbatim descriptions seen in the filings. */
export interface VerifiedLine {
  code: string;
  descriptions: readonly string[];
}

/**
 * A cash-flow line whose code drifts between filings. Matched by
 * description inside `section` (a code prefix); exactly one row must match.
 */
export interface SectionLine {
  section: string;
  descriptions: readonly string[];
}

export interface MarketInfrastructureIdentity {
  ticker: string;
  cvmCode: string;
  cnpj: string;
  /** DENOM_SOCIAL in the CVM registry. */
  legalName: string;
  tradingName: string;
  registration: string;
  isin: string;
  shareClassKind: "ON";
  /** composicao_capital scale for this issuer (verified against B3's own share count). */
  capitalCompositionUnit: "shares";
  /** Verified anchor (composicao_capital 2026-06-30 v1). */
  shareCountAnchor: { referenceDate: string; issued: number; treasury: number; outstanding: number };
}

export const B3SA3_IDENTITY: MarketInfrastructureIdentity = {
  ticker: "B3SA3",
  cvmCode: "21610",
  cnpj: "09.346.601/0001-25",
  legalName: "B3 S.A. - BRASIL, BOLSA, BALCÃO",
  tradingName: "B3",
  registration: "ATIVO, Categoria A",
  isin: "BRB3SAACNOR6",
  shareClassKind: "ON",
  capitalCompositionUnit: "shares",
  shareCountAnchor: { referenceDate: "2026-06-30", issued: 5_046_500_000, treasury: 48_201_452, outstanding: 4_998_298_548 },
};

export const VERIFIED_MARKET_INFRASTRUCTURE_IDENTITIES: Readonly<Record<string, MarketInfrastructureIdentity>> = {
  B3SA3: B3SA3_IDENTITY,
};

export function getMarketInfrastructureIdentity(ticker: string): MarketInfrastructureIdentity | null {
  return VERIFIED_MARKET_INFRASTRUCTURE_IDENTITIES[ticker.toUpperCase()] ?? null;
}

// ─── Fixed CVM accounts (ST_CONTA_FIXA = S) ───────────────────────────────────

export const FIXED_ACCOUNTS = {
  grossRevenue:            { statement: "DRE", code: "3.01",    description: "Receita de Venda de Bens e/ou Serviços" },
  revenueDeductions:       { statement: "DRE", code: "3.02",    description: "Custo dos Bens e/ou Serviços Vendidos" },
  netRevenue:              { statement: "DRE", code: "3.03",    description: "Resultado Bruto" },
  sellingExpenses:         { statement: "DRE", code: "3.04.01", description: "Despesas com Vendas" },
  operatingExpenses:       { statement: "DRE", code: "3.04.02", description: "Despesas Gerais e Administrativas" },
  impairmentLosses:        { statement: "DRE", code: "3.04.03", description: "Perdas pela Não Recuperabilidade de Ativos" },
  otherOperatingIncome:    { statement: "DRE", code: "3.04.04", description: "Outras Receitas Operacionais" },
  otherOperatingExpenses:  { statement: "DRE", code: "3.04.05", description: "Outras Despesas Operacionais" },
  equityMethodIncome:      { statement: "DRE", code: "3.04.06", description: "Resultado de Equivalência Patrimonial" },
  ebit:                    { statement: "DRE", code: "3.05",    description: "Resultado Antes do Resultado Financeiro e dos Tributos" },
  financialResult:         { statement: "DRE", code: "3.06",    description: "Resultado Financeiro" },
  pretaxIncome:            { statement: "DRE", code: "3.07",    description: "Resultado Antes dos Tributos sobre o Lucro" },
  incomeTax:               { statement: "DRE", code: "3.08",    description: "Imposto de Renda e Contribuição Social sobre o Lucro" },
  netIncomeConsolidated:   { statement: "DRE", code: "3.11",    description: "Lucro/Prejuízo Consolidado do Período" },
  netIncomeAttributable:   { statement: "DRE", code: "3.11.01", description: "Atribuído a Sócios da Empresa Controladora" },
  balanceSheetCash:        { statement: "BPA", code: "1.01.01", description: "Caixa e Equivalentes de Caixa" },
  currentInvestments:      { statement: "BPA", code: "1.01.02", description: "Aplicações Financeiras" },
  ltInvestmentsFvtpl:      { statement: "BPA", code: "1.02.01.01", description: "Aplicações Financeiras Avaliadas a Valor Justo através do Resultado" },
  ltInvestmentsFvoci:      { statement: "BPA", code: "1.02.01.02", description: "Aplicações Financeiras Avaliadas a Valor Justo através de Outros Resultados Abrangentes" },
  ltInvestmentsAmortized:  { statement: "BPA", code: "1.02.01.03", description: "Aplicações Financeiras Avaliadas ao Custo Amortizado" },
  currentDebt:             { statement: "BPP", code: "2.01.04", description: "Empréstimos e Financiamentos" },
  nonCurrentDebt:          { statement: "BPP", code: "2.02.01", description: "Empréstimos e Financiamentos" },
  otherNonCurrentOthers:   { statement: "BPP", code: "2.02.02.02", description: "Outros" },
  equity:                  { statement: "BPP", code: "2.03",    description: "Patrimônio Líquido Consolidado" },
  nonControllingInterests: { statement: "BPP", code: "2.03.09", description: "Participação dos Acionistas Não Controladores" },
  operatingCashFlow:       { statement: "DFC", code: "6.01",    description: "Caixa Líquido Atividades Operacionais" },
  cashChange:              { statement: "DFC", code: "6.05",    description: "Aumento (Redução) de Caixa e Equivalentes" },
  openingCash:             { statement: "DFC", code: "6.05.01", description: "Saldo Inicial de Caixa e Equivalentes" },
  closingCash:             { statement: "DFC", code: "6.05.02", description: "Saldo Final de Caixa e Equivalentes" },
} as const;

export type FixedAccountKey = keyof typeof FIXED_ACCOUNTS;

// ─── Issuer-specific lines ────────────────────────────────────────────────────

/** Third-party liabilities and derivative liabilities in B3's capital-management formula. */
export const THIRD_PARTY_LINES = {
  // Seen 2019-03 … 2026-06 (singular "Garantia" is B3's spelling).
  collateralReceived: { code: "2.01.05.02.04", descriptions: ["Garantia Recebidas em Operações"] },
  custodyPayments:    { code: "2.01.05.02.05", descriptions: ["Proventos e Direitos sobre Títulos em Custódia"] },
} as const satisfies Record<string, VerifiedLine>;

export const DERIVATIVE_LIABILITY_LINES = {
  current:    { code: "2.01.05.02.08", descriptions: ["Instrumentos Financeiros Derivativos"] },
  // Filed 2020-03 … 2025-09; absent in other filings (zero, proven by the 2.02.02.02 parent sum).
  nonCurrent: { code: "2.02.02.02.04", descriptions: ["Instrumentos Financeiros Derivativos"] },
} as const satisfies Record<string, VerifiedLine>;

/** Cash-flow lines (DFC_MI). Codes drift (6.02.02–6.02.06, 6.03.01–6.03.08), so sections + descriptions. */
export const CASH_FLOW_LINES = {
  depreciationAmortization: { section: "6.01.01.", descriptions: ["Depreciação e Amortização", "Depreciação/Amortização"] },
  capexProperty:   { section: "6.02.", descriptions: ["Aquisição de Imobilizado", "Pagamento pela Aquisição de Imobilizado"] },
  capexSoftware:   { section: "6.02.", descriptions: ["Aquisição e Desenvolvimento de Softwares", "Aquisição de Softwares e Projetos"] },
  distributionsPaid: {
    section: "6.03.",
    descriptions: [
      "Pagamento de Proventos",
      "Pagamentos de proventos",
      "Pagto Dividendos e Juros Capital Próprio",
      "Pagamento de Dividendos e Juros sobre Capital Próprio",
    ],
  },
  buybacks: { section: "6.03.", descriptions: ["Recompra de Ações"] },
} as const satisfies Record<string, SectionLine>;

/** Revenue-tax sub-lines. ITRs 2019–2022 filed them inside 3.01 (then 3.02 = 0). */
export const REVENUE_TAX_DESCRIPTIONS: readonly string[] = ["PIS e Cofins", "PIS e COFINS", "Impostos sobre Serviços"];

// ─── Revenue segment taxonomy (CVM 3.01.0x) ──────────────────────────────────

export interface SegmentDefinition {
  id: RevenueSegmentId;
  code: string;
  /** Verbatim labels verified to be the same current-taxonomy concept. */
  labels: readonly string[];
}

/**
 * Current taxonomy (1T25 onward; FY2024 and 2024 quarters restated as
 * comparatives). Variants verified by value: 1T25 "Tecnologia & Serviços"
 * 459,516k equals the 1T25 "Tecnologia & Plataformas" comparative in 1T26;
 * "(Trillia)" was appended from 2T26 with unchanged comparatives; "Reversão
 * de Provisão" is the same line the workbook calls "Outras receitas".
 */
export const CURRENT_SEGMENT_TAXONOMY: readonly SegmentDefinition[] = [
  { id: "mercados", code: "3.01.01", labels: ["Mercados"] },
  { id: "solucoes_analiticas_de_dados", code: "3.01.02", labels: ["Soluções Analíticas de Dados", "Soluções Analíticas de Dados (Trillia)"] },
  { id: "solucoes_para_mercado_de_capitais", code: "3.01.03", labels: ["Soluções para o Mercado de Capitais"] },
  { id: "tecnologia_e_plataformas", code: "3.01.04", labels: ["Tecnologia & Plataformas", "Tecnologia & Serviços"] },
  { id: "outras_receitas", code: "3.01.05", labels: ["Reversão de Provisões e Recuperação de Despesas", "Reversão de Provisão"] },
];

/** Pre-2025 taxonomy — recognised so it is skipped (never back-cast), not reported as unknown. */
export const LEGACY_SEGMENT_LABELS: readonly string[] = [
  "Segmento Listado",
  "Segmento Balcão",
  "Segmento Infraestrutura para Financiamento",
  "Segmento Tecnologia, Dados e Serviços",
];

/** Current-taxonomy segment history starts with FY2024 (restated comparatives). */
export const SEGMENT_HISTORY_START_YEAR = 2024;
/** Statement history starts with FY2019. */
export const STATEMENT_HISTORY_START_YEAR = 2019;

// ─── Description matching ────────────────────────────────────────────────────

/** Lowercase, accent-free, punctuation-free, without connective words. */
export function normalizeDescription(s: string): string {
  return s
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(w => w && !["o", "a", "os", "as", "e", "de", "do", "da", "dos", "das"].includes(w))
    .join(" ");
}

export function matchesAny(descriptions: readonly string[], description: string): boolean {
  const target = normalizeDescription(description);
  return descriptions.some(d => normalizeDescription(d) === target);
}
