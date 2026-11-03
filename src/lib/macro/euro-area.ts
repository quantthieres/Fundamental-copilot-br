// Euro-area membership for the policy-rate indicator.
//
// From its adoption month onward a member has no national policy rate: the
// ECB's single monetary policy applies, which BIS publishes as REF_AREA "XM".
// Before adoption the member keeps its own national BIS series (when BIS has
// one). XM is never applied before a country's adoption month, nor to
// non-members (e.g. POL, DNK, SWE, HUN, CZE, ROU).
//
// Sources (verified 2026-11-02):
//   - ECB, "Our currency, the euro" country list
//     (https://www.ecb.europa.eu/euro/intro/html/index.en.html): "Euro since
//     1999" for AT, BE, FI, FR, DE, IE, IT, LU, NL, PT, ES; 2001 GR; 2007 SI;
//     2008 CY, MT; 2009 SK; 2011 EE; 2014 LV; 2015 LT; 2023 HR; 2026 BG.
//   - Every adoption took effect on 1 January of that year (start of Stage
//     Three of EMU on 1 Jan 1999; later entrants by Council decision, e.g.
//     Council Decision (EU) 2025/1407 "on the adoption by Bulgaria of the euro
//     on 1 January 2026").
//
// No @/ imports — also used by tsx scripts.

export const EURO_AREA_REF_AREA = "XM";
export const EURO_AREA_NAME_PT = "Área do euro (BCE)";

/** ISO-3 → first month ("YYYY-MM") in which the ECB policy rate applies. */
export const EURO_AREA_ADOPTION: Readonly<Record<string, string>> = {
  AUT: "1999-01",
  BEL: "1999-01",
  DEU: "1999-01",
  ESP: "1999-01",
  FIN: "1999-01",
  FRA: "1999-01",
  IRL: "1999-01",
  ITA: "1999-01",
  LUX: "1999-01",
  NLD: "1999-01",
  PRT: "1999-01",
  GRC: "2001-01",
  SVN: "2007-01",
  CYP: "2008-01",
  MLT: "2008-01",
  SVK: "2009-01",
  EST: "2011-01",
  LVA: "2014-01",
  LTU: "2015-01",
  HRV: "2023-01",
  BGR: "2026-01",
};

export function getEuroAdoptionPeriod(iso3: string): string | null {
  return EURO_AREA_ADOPTION[iso3] ?? null;
}

/** True when the ECB (BIS XM) rate is the country's policy rate in `period` ("YYYY-MM"). */
export function usesEuroAreaRate(iso3: string, period: string): boolean {
  const adoption = EURO_AREA_ADOPTION[iso3];
  return adoption !== undefined && period >= adoption;
}
