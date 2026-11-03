// Macro Map v1 indicator registry.
//
// Source codes verified 2026-11-02 against the official metadata:
//   IMF SDMX 2.1  datastructure IMF.RES/DSD_WEO/9.0.0, codelist CL_WEO_INDICATOR(2.0.3)
//     PCPIPCH      All Items, Consumer price index (CPI), Period average, percent change
//     NGDP_RPCH    Gross domestic product (GDP), Constant prices, Percent change
//     LUR          Unemployment rate
//     GGXWDG_NGDP  Gross debt, General government, Percent of GDP
//   BIS SDMX      dataflow BIS:WS_CBPOL(1.0) "Central bank policy rates",
//                 FREQ=M (end of period), UNIT_MEASURE 368 "Per cent per year"
//
// No @/ imports — also used by tsx scripts.

import type { MacroIndicatorId, MacroIndicatorMetadata } from "./macro-types";

export const MACRO_INDICATOR_IDS: readonly MacroIndicatorId[] = [
  "inflation",
  "policy_rate",
  "real_gdp_growth",
  "unemployment",
  "gov_debt_gdp",
];

export const MACRO_INDICATORS: Readonly<Record<MacroIndicatorId, MacroIndicatorMetadata>> = {
  inflation: {
    id: "inflation",
    labelPt: "Inflação",
    unit: "%",
    conceptPt: "Inflação ao consumidor, variação da média anual do IPC",
    frequency: "annual",
    source: "imf_weo",
    sourceCode: "PCPIPCH",
    cacheFile: "inflation.json",
  },
  policy_rate: {
    id: "policy_rate",
    labelPt: "Taxa básica",
    unit: "% a.a.",
    conceptPt: "Taxa básica de política monetária do banco central (fim do mês)",
    frequency: "monthly",
    source: "bis_cbpol",
    sourceCode: "WS_CBPOL",
    cacheFile: "policy-rate.json",
  },
  real_gdp_growth: {
    id: "real_gdp_growth",
    labelPt: "Crescimento real do PIB",
    unit: "%",
    conceptPt: "Variação anual do PIB a preços constantes",
    frequency: "annual",
    source: "imf_weo",
    sourceCode: "NGDP_RPCH",
    cacheFile: "real-gdp-growth.json",
  },
  unemployment: {
    id: "unemployment",
    labelPt: "Desemprego",
    unit: "%",
    conceptPt: "Taxa de desemprego (% da força de trabalho)",
    frequency: "annual",
    source: "imf_weo",
    sourceCode: "LUR",
    cacheFile: "unemployment.json",
  },
  gov_debt_gdp: {
    id: "gov_debt_gdp",
    labelPt: "Dívida pública / PIB",
    unit: "% do PIB",
    conceptPt: "Dívida bruta do governo geral em % do PIB",
    frequency: "annual",
    source: "imf_weo",
    sourceCode: "GGXWDG_NGDP",
    cacheFile: "gov-debt-gdp.json",
  },
};

export const WEO_INDICATOR_IDS: readonly MacroIndicatorId[] = MACRO_INDICATOR_IDS.filter(
  id => MACRO_INDICATORS[id].source === "imf_weo",
);

export function isMacroIndicatorId(value: string): value is MacroIndicatorId {
  return (MACRO_INDICATOR_IDS as readonly string[]).includes(value);
}

/**
 * Accepts the machine id ("real_gdp_growth") or its URL slug
 * ("real-gdp-growth"). Anything else returns null.
 */
export function parseMacroIndicatorParam(raw: string): MacroIndicatorId | null {
  const id = raw.trim().toLowerCase().replace(/-/g, "_");
  return isMacroIndicatorId(id) ? id : null;
}

/** First year kept in the normalized WEO caches (keeps the files compact). */
export const WEO_START_YEAR = 2000;

/**
 * First year kept for BIS policy rates. Earlier than WEO so that pre-euro
 * national series (e.g. FRA/DEU up to 1998-12) remain visible.
 */
export const BIS_START_YEAR = 1990;

/** Lowest year accepted by the API (earliest year any cache may contain). */
export const MACRO_START_YEAR = Math.min(WEO_START_YEAR, BIS_START_YEAR);
