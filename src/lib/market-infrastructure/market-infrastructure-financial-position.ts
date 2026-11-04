// B3 financial position — own vs third-party balances.
//
// B3's consolidated balance sheet carries participants' resources: cash
// collateral (2.01.05.02.04) and proceeds/rights on securities in custody
// (2.01.05.02.05) are liabilities, backed by assets inside cash (1.01.01) and
// financial investments. So:
//
//   - 1.01.01 is stored as balanceSheetCashReported — never "B3 cash";
//   - no cash − debt net debt is computed;
//   - cashAndCashEquivalentsPerCashFlow is the cash-flow statement's closing
//     cash (6.05.02), kept as a SECONDARY/provenance field only — used only
//     when the DFC reconciles and it does not exceed 1.01.01, never a residual
//     guess, and never an input to the managed position, leverage or any
//     liquidity measure. B3's ITR 2T26 note 4 states this figure is its own
//     cash excluding third-party resources (R$355,309k vs R$1,163,233k in
//     1.01.01); that reading is validated only for OWN_CASH_INTERPRETATION_VALIDATED_FOR;
//   - the principal metric reproduces B3's capital-management note
//     ("diferença entre os ativos e os passivos financeiros geridos"):
//
//       managedNetFinancialPosition =
//           1.01.01 + 1.01.02 + 1.02.01.01 + 1.02.01.02 + 1.02.01.03
//         − (2.01.05.02.08 + 2.02.02.02.04)   derivative liabilities
//         − (2.01.04 + 2.02.01)               gross debt
//         − 2.01.05.02.04                     collateral received
//         − 2.01.05.02.05                     custody payments
//
//     Derivative assets are inside the investment accounts. Any missing or
//     unverified component makes the whole measure null.
//
// It is NOT free cash: it still includes B3-owned resources earmarked for the
// clearinghouses/regulation and Banco B3 settlement balances, which only the
// PDF notes split out (Phase 1 does not subtract them).
//
// No @/ imports — also used by tsx scripts.

import type { FinancialPosition, MarketInfrastructureStatement } from "./market-infrastructure-types";

export const MANAGED_NET_FINANCIAL_POSITION_METHOD =
  "B3 capital-management concept: (1.01.01 + 1.01.02 + 1.02.01.01 + 1.02.01.02 + 1.02.01.03) − derivative liabilities (2.01.05.02.08 + 2.02.02.02.04) − gross debt (2.01.04 + 2.02.01) − collateral received (2.01.05.02.04) − custody payments (2.01.05.02.05); consolidated, at the balance-sheet date.";

export const CASH_FLOW_CASH_METHOD =
  "Closing cash of the consolidated cash-flow statement (6.05.02) as filed; used only when 6.05.01 + 6.05 = 6.05.02 and it does not exceed 1.01.01. Secondary/provenance — not used in the managed position, leverage or liquidity.";

/**
 * Periods where B3 itself states that the cash-flow cash excludes third-party
 * resources (ITR 2T26, note 4a: caixa e equivalentes R$355,309k; recursos de
 * terceiros R$807,924k). Extend only after validating another period's note.
 */
export const OWN_CASH_INTERPRETATION_VALIDATED_FOR: readonly string[] = ["2026-06-30"];

export const FINANCIAL_POSITION_CAVEATS: readonly string[] = [
  "A posição financeira líquida gerida segue o conceito da nota de gestão de capital da B3 e não é caixa livre.",
  "Pode incluir recursos próprios da B3 vinculados às câmaras de compensação e a exigências regulatórias (contribuição a fundos de liquidação, caixa dedicado, patrimônio especial) e saldos de liquidação do Banco B3; esse detalhamento só existe nas notas explicativas e não é subtraído.",
  "Saldos de terceiros (garantias recebidas em dinheiro e proventos em custódia) são subtraídos e mostrados à parte; não entram em nenhuma medida de liquidez da companhia.",
  "O caixa do balanço (1.01.01) inclui recursos de terceiros e não é tratado como caixa da B3.",
];

export function buildFinancialPosition(st: MarketInfrastructureStatement): FinancialPosition {
  const issues: string[] = [];
  const components: FinancialPosition["components"] = [
    { label: "Caixa e equivalentes (balanço)", accounts: ["1.01.01"], value: st.balanceSheetCashReported, sign: 1 },
    { label: "Aplicações financeiras (inclui derivativos ativos)", accounts: ["1.01.02", "1.02.01.01", "1.02.01.02", "1.02.01.03"], value: st.financialInvestments, sign: 1 },
    { label: "Derivativos passivos", accounts: ["2.01.05.02.08", "2.02.02.02.04"], value: st.derivativeLiabilities, sign: -1 },
    { label: "Dívida bruta", accounts: ["2.01.04", "2.02.01"], value: st.grossDebt, sign: -1 },
    { label: "Garantias recebidas em operações (terceiros)", accounts: ["2.01.05.02.04"], value: st.collateralReceived, sign: -1 },
    { label: "Proventos e direitos sobre títulos em custódia (terceiros)", accounts: ["2.01.05.02.05"], value: st.custodyPayments, sign: -1 },
  ];
  const missing = components.filter(c => c.value === null);
  if (missing.length > 0) issues.push(`managed net financial position unavailable: ${missing.map(c => c.accounts.join("+")).join(", ")} not validated`);
  const managed = missing.length > 0 ? null : components.reduce((s, c) => s + c.sign * c.value!, 0);

  let cashPerCashFlow: number | null = null;
  const closing = st.cashFlowStatementClosingCash;
  if (closing === null) {
    issues.push("cash-flow closing cash unavailable: 6.05.01 + 6.05 ≠ 6.05.02 or not filed");
  } else if (st.balanceSheetCashReported === null || closing > st.balanceSheetCashReported) {
    issues.push("cash-flow closing cash unavailable: 6.05.02 exceeds 1.01.01 or 1.01.01 missing — classification must be re-verified");
  } else {
    cashPerCashFlow = closing;
  }

  return {
    referenceDate: st.periodEnd,
    balanceSheetCashReported: st.balanceSheetCashReported,
    cashAndCashEquivalentsPerCashFlow: cashPerCashFlow,
    cashFlowCashMethod: CASH_FLOW_CASH_METHOD,
    ownCashInterpretationValidatedFor: OWN_CASH_INTERPRETATION_VALIDATED_FOR.filter(d => d === st.periodEnd),
    balanceSheetCashNotInCashFlowCash: cashPerCashFlow !== null && st.balanceSheetCashReported !== null ? st.balanceSheetCashReported - cashPerCashFlow : null,
    financialInvestments: st.financialInvestments,
    grossDebt: st.grossDebt,
    derivativeLiabilities: st.derivativeLiabilities,
    thirdPartyBalances: {
      referenceDate: st.periodEnd,
      collateralReceived: st.collateralReceived,
      custodyPayments: st.custodyPayments,
      otherValidatedThirdPartyBalances: [],
    },
    managedNetFinancialPosition: managed,
    managedNetFinancialPositionMethod: MANAGED_NET_FINANCIAL_POSITION_METHOD,
    components,
    caveats: [...FINANCIAL_POSITION_CAVEATS],
    issues,
  };
}
