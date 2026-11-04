import { describe, expect, it } from "vitest";
import { cvmFixtureFiles, fixtureZipLoader } from "./__fixtures__/fixtures";
import { parseCapitalCsv } from "./holding-cvm-rows";
import { loadHoldingCvmData } from "./holding-cvm-client";
import { VERIFIED_HOLDING_IDENTITIES } from "./holding-identities";
import { buildShareClasses, latestCapital, totalOutstandingShares } from "./holding-share-classes";

// CVM composicao_capital (ITR 2026), in thousands of shares — official rows.
const capitalCsv = cvmFixtureFiles("ITR", 2026)["itr_cia_aberta_composicao_capital_2026.csv"];

describe("share classes from CVM composicao_capital", () => {
  it("Itaúsa 2026-06-30: issued, treasury and outstanding per class", () => {
    const entries = parseCapitalCsv(capitalCsv, "61.532.644/0001-15").map(e => ({ ...e, document: "ITR" as const }));
    const latest = latestCapital(entries)!;
    expect(latest).toMatchObject({ periodEnd: "2026-06-30", version: 2 });
    const classes = buildShareClasses(VERIFIED_HOLDING_IDENTITIES.ITSA4, latest);
    expect(classes).toEqual([
      { ticker: "ITSA3", kind: "ON", isin: "BRITSAACNOR0", issuedShares: 3_853_634_000, treasuryShares: 0,
        outstandingShares: 3_853_634_000, referenceDate: "2026-06-30", source: "cvm_itr_composicao_capital" },
      { ticker: "ITSA4", kind: "PN", isin: "BRITSAACNPR7", issuedShares: 7_360_053_000, treasuryShares: 6_337_000,
        outstandingShares: 7_353_716_000, referenceDate: "2026-06-30", source: "cvm_itr_composicao_capital" },
    ]);
    // Matches the 11,207 mn shares ex-treasury on Itaúsa's portfolio page.
    expect(totalOutstandingShares(classes)).toBe(11_207_350_000);
  });

  it("Bradespar 2026-06-30: two classes, no treasury shares", () => {
    const entries = parseCapitalCsv(capitalCsv, "03.847.461/0001-92").map(e => ({ ...e, document: "ITR" as const }));
    const classes = buildShareClasses(VERIFIED_HOLDING_IDENTITIES.BRAP4, latestCapital(entries));
    expect(classes.map(c => [c.ticker, c.issuedShares, c.treasuryShares, c.outstandingShares])).toEqual([
      ["BRAP3", 137_990_000, 0, 137_990_000],
      ["BRAP4", 255_107_000, 0, 255_107_000],
    ]);
  });

  it("classes stay separate and unknown counts stay null", () => {
    const classes = buildShareClasses(VERIFIED_HOLDING_IDENTITIES.BRAP4, null);
    expect(classes.map(c => c.ticker)).toEqual(["BRAP3", "BRAP4"]);
    expect(classes.every(c => c.issuedShares === null && c.outstandingShares === null)).toBe(true);
    expect(totalOutstandingShares(classes)).toBeNull();
  });

  it("the loader collects capital snapshots from every filing", async () => {
    const res = await loadHoldingCvmData(VERIFIED_HOLDING_IDENTITIES.ITSA4, { dfp: [2025], itr: [2026], optional: [] }, fixtureZipLoader());
    expect(latestCapital(res.capital)).toMatchObject({ periodEnd: "2026-06-30", document: "ITR", treasuryPn: 6_337_000 });
  });

  it("rejects a malformed share count", () => {
    expect(() => parseCapitalCsv(capitalCsv.replace(";137990;", ";n/d;"), "03.847.461/0001-92")).toThrow(/bad share count/);
  });
});
