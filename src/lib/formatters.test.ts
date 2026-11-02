import { describe, it, expect } from "vitest";
import { formatFiscalYearRange } from "./formatters";

describe("formatFiscalYearRange", () => {
  it("derives the range from the rendered years", () => {
    expect(formatFiscalYearRange(["2020", "2021", "2022", "2023", "2024", "2025"])).toBe("AF2020–AF2025");
    expect(formatFiscalYearRange(["2021", "2022", "2023", "2024"])).toBe("AF2021–AF2024");
  });

  it("is order-independent", () => {
    expect(formatFiscalYearRange(["2025", "2020", "2023"])).toBe("AF2020–AF2025");
  });

  it("collapses a single year", () => {
    expect(formatFiscalYearRange(["2025"])).toBe("AF2025");
  });

  it("returns null for no usable years", () => {
    expect(formatFiscalYearRange([])).toBeNull();
    expect(formatFiscalYearRange(["LTM", ""])).toBeNull();
  });
});
