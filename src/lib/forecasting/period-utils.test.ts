import { describe, it, expect } from "vitest";
import {
  parseQuarterPeriod,
  compareQuarterPeriods,
  addQuarters,
  nextQuarterPeriod,
  generateFuturePeriods,
} from "./period-utils";

// ─── A. parseQuarterPeriod ────────────────────────────────────────────────────

describe("parseQuarterPeriod", () => {
  it("parses a valid period", () => {
    expect(parseQuarterPeriod("2024Q2")).toEqual({ year: 2024, quarter: 2 });
  });

  it("parses Q1 and Q4 boundaries", () => {
    expect(parseQuarterPeriod("2020Q1")).toEqual({ year: 2020, quarter: 1 });
    expect(parseQuarterPeriod("2020Q4")).toEqual({ year: 2020, quarter: 4 });
  });

  it("throws on invalid format", () => {
    expect(() => parseQuarterPeriod("2024-Q2")).toThrow();
    expect(() => parseQuarterPeriod("2024")).toThrow();
    expect(() => parseQuarterPeriod("Q2")).toThrow();
    expect(() => parseQuarterPeriod("2024Q5")).toThrow();
    expect(() => parseQuarterPeriod("")).toThrow();
  });
});

// ─── A. addQuarters ───────────────────────────────────────────────────────────

describe("addQuarters", () => {
  it("2024Q4 + 1 = 2025Q1", () => {
    expect(addQuarters("2024Q4", 1)).toBe("2025Q1");
  });

  it("2024Q3 + 2 = 2025Q1", () => {
    expect(addQuarters("2024Q3", 2)).toBe("2025Q1");
  });

  it("2024Q1 + 4 = 2025Q1", () => {
    expect(addQuarters("2024Q1", 4)).toBe("2025Q1");
  });

  it("2024Q4 + 0 = 2024Q4 (no change)", () => {
    expect(addQuarters("2024Q4", 0)).toBe("2024Q4");
  });

  it("wraps across multiple years", () => {
    expect(addQuarters("2023Q4", 5)).toBe("2025Q1");
  });

  it("handles negative offset", () => {
    expect(addQuarters("2025Q1", -1)).toBe("2024Q4");
  });
});

// ─── A. nextQuarterPeriod ─────────────────────────────────────────────────────

describe("nextQuarterPeriod", () => {
  it("returns the next quarter", () => {
    expect(nextQuarterPeriod("2024Q3")).toBe("2024Q4");
    expect(nextQuarterPeriod("2024Q4")).toBe("2025Q1");
  });
});

// ─── A. compareQuarterPeriods ─────────────────────────────────────────────────

describe("compareQuarterPeriods", () => {
  it("returns negative when a < b", () => {
    expect(compareQuarterPeriods("2024Q1", "2024Q2")).toBeLessThan(0);
    expect(compareQuarterPeriods("2023Q4", "2024Q1")).toBeLessThan(0);
  });

  it("returns positive when a > b", () => {
    expect(compareQuarterPeriods("2025Q1", "2024Q4")).toBeGreaterThan(0);
  });

  it("returns 0 for equal periods", () => {
    expect(compareQuarterPeriods("2024Q2", "2024Q2")).toBe(0);
  });

  it("sorts an array correctly", () => {
    const periods = ["2025Q1", "2024Q3", "2024Q1", "2024Q4", "2025Q2"];
    const sorted = [...periods].sort(compareQuarterPeriods);
    expect(sorted).toEqual(["2024Q1", "2024Q3", "2024Q4", "2025Q1", "2025Q2"]);
  });
});

// ─── A. generateFuturePeriods ─────────────────────────────────────────────────

describe("generateFuturePeriods", () => {
  it("generates the correct future periods", () => {
    expect(generateFuturePeriods("2025Q3", 3)).toEqual(["2025Q4", "2026Q1", "2026Q2"]);
  });

  it("returns empty array for horizon 0", () => {
    expect(generateFuturePeriods("2025Q3", 0)).toEqual([]);
  });

  it("wraps year correctly from Q4", () => {
    expect(generateFuturePeriods("2025Q4", 2)).toEqual(["2026Q1", "2026Q2"]);
  });

  it("generates 8 quarters", () => {
    const periods = generateFuturePeriods("2025Q3", 8);
    expect(periods).toHaveLength(8);
    expect(periods[0]).toBe("2025Q4");
    expect(periods[7]).toBe("2027Q3");
  });
});
