import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { getDfpYears } from "./dfp-years";

const IN_2026 = new Date("2026-06-15T12:00:00Z");
const IN_2027 = new Date("2027-03-01T12:00:00Z");

describe("getDfpYears — default closed-fiscal-year window", () => {
  it("during 2026 returns 2020..2025", () => {
    expect(getDfpYears(IN_2026, {})).toEqual([2020, 2021, 2022, 2023, 2024, 2025]);
  });

  it("during 2027 includes 2026", () => {
    const years = getDfpYears(IN_2027, {});
    expect(years[0]).toBe(2020);
    expect(years.at(-1)).toBe(2026);
  });

  it("uses UTC so New Year's Eve/Day boundaries are stable", () => {
    expect(getDfpYears(new Date("2026-12-31T23:59:59Z"), {}).at(-1)).toBe(2025);
    expect(getDfpYears(new Date("2027-01-01T00:00:00Z"), {}).at(-1)).toBe(2026);
  });

  it("treats empty overrides as unset", () => {
    expect(getDfpYears(IN_2026, { CVM_DFP_START_YEAR: "", CVM_DFP_END_YEAR: "  " }))
      .toEqual([2020, 2021, 2022, 2023, 2024, 2025]);
  });
});

describe("getDfpYears — overrides", () => {
  it("applies custom start and end", () => {
    expect(getDfpYears(IN_2026, { CVM_DFP_START_YEAR: "2022", CVM_DFP_END_YEAR: "2024" }))
      .toEqual([2022, 2023, 2024]);
  });

  it("allows a single-year window and whitespace around values", () => {
    expect(getDfpYears(IN_2026, { CVM_DFP_START_YEAR: " 2025 ", CVM_DFP_END_YEAR: "2025" })).toEqual([2025]);
  });

  it("rejects start > end", () => {
    expect(() => getDfpYears(IN_2026, { CVM_DFP_START_YEAR: "2025", CVM_DFP_END_YEAR: "2023" }))
      .toThrow(/range is empty/);
  });

  it.each(["abc", "2025.5", "25", "2025a", "-2024", "1e3"])("rejects non-integer value %s", raw => {
    expect(() => getDfpYears(IN_2026, { CVM_DFP_START_YEAR: raw })).toThrow(/4-digit year/);
    expect(() => getDfpYears(IN_2026, { CVM_DFP_END_YEAR: raw })).toThrow(/4-digit year/);
  });

  it("rejects out-of-bounds years", () => {
    expect(() => getDfpYears(IN_2026, { CVM_DFP_START_YEAR: "1999" })).toThrow(/>= 2010/);
    expect(() => getDfpYears(IN_2026, { CVM_DFP_END_YEAR: "2030" })).toThrow(/<= 2026/);
  });
});

describe("getDfpYears — defaults read the clock and process.env", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(IN_2027);
    vi.stubEnv("CVM_DFP_START_YEAR", "");
    vi.stubEnv("CVM_DFP_END_YEAR", "");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("uses the pinned system time when called without arguments", () => {
    expect(getDfpYears().at(-1)).toBe(2026);
  });

  it("reads overrides from process.env", () => {
    vi.stubEnv("CVM_DFP_END_YEAR", "2023");
    expect(getDfpYears()).toEqual([2020, 2021, 2022, 2023]);
  });
});
