import { describe, it, expect } from "vitest";
import { MACRO_INDICATOR_IDS } from "./macro-indicators";
import { MACRO_NO_DATA_COLOR, MACRO_SCALES, colorForValue, legendBins, scaleBinIndex } from "./macro-scales";

describe("macro color scales", () => {
  it("defines a fixed scale for every indicator with one color per bin", () => {
    for (const id of MACRO_INDICATOR_IDS) {
      const s = MACRO_SCALES[id];
      expect(s.colors).toHaveLength(s.boundaries.length + 1);
      expect([...s.boundaries]).toEqual([...s.boundaries].sort((a, b) => a - b));
      expect(new Set(s.colors).size).toBe(s.colors.length);
      expect(s.colors).not.toContain(MACRO_NO_DATA_COLOR);
    }
  });

  it("selects bins with closed lower / open upper edges", () => {
    const s = MACRO_SCALES.inflation; // [2, 4, 6, 10, 20, 50]
    expect(scaleBinIndex(s, -1.5)).toBe(0);
    expect(scaleBinIndex(s, 1.99)).toBe(0);
    expect(scaleBinIndex(s, 2)).toBe(1);
    expect(scaleBinIndex(s, 9.99)).toBe(3);
    expect(scaleBinIndex(s, 20)).toBe(5);
    expect(scaleBinIndex(s, 467)).toBe(6);
  });

  it("returns the no-data color for missing or non-finite values", () => {
    expect(scaleBinIndex(MACRO_SCALES.inflation, null)).toBeNull();
    expect(scaleBinIndex(MACRO_SCALES.inflation, Number.NaN)).toBeNull();
    expect(colorForValue("unemployment", null)).toBe(MACRO_NO_DATA_COLOR);
    expect(colorForValue("unemployment", undefined)).toBe(MACRO_NO_DATA_COLOR);
  });

  it("GDP growth diverges at zero: contractions and growth never share a bin", () => {
    const s = MACRO_SCALES.real_gdp_growth;
    expect(s.kind).toBe("diverging");
    expect(s.boundaries[s.zeroBoundaryIndex!]).toBe(0);
    const negative = scaleBinIndex(s, -0.01)!;
    const zero = scaleBinIndex(s, 0)!;
    expect(negative).toBeLessThan(zero);
    expect(colorForValue("real_gdp_growth", -0.01)).not.toBe(colorForValue("real_gdp_growth", 0.01));
    expect(legendBins("real_gdp_growth").findIndex(b => b.startsAtZero)).toBe(zero);
  });

  it("policy rate keeps resolution near zero and in the high tail", () => {
    const s = MACRO_SCALES.policy_rate;
    expect(scaleBinIndex(s, 0)).not.toBe(scaleBinIndex(s, 1.5));
    expect(scaleBinIndex(s, 12)).not.toBe(scaleBinIndex(s, 40));
  });

  it("builds human-readable legend labels", () => {
    expect(legendBins("inflation").map(b => b.label)).toEqual(["< 2", "2 a 4", "4 a 6", "6 a 10", "10 a 20", "20 a 50", "≥ 50"]);
    expect(legendBins("real_gdp_growth")[0].label).toBe("< −2");
    expect(legendBins("real_gdp_growth")[1].label).toBe("−2 a 0");
  });
});
