import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const getMacroIndicatorView = vi.fn();

vi.mock("@/lib/macro/macro-cache", async importOriginal => {
  const actual = await importOriginal<typeof import("@/lib/macro/macro-cache")>();
  return { ...actual, getMacroIndicatorView: (...args: unknown[]) => getMacroIndicatorView(...args) };
});

const { GET } = await import("./route");

function call(indicator: string, query = "") {
  const req = new NextRequest(`http://localhost/api/macro/${indicator}${query}`);
  return GET(req, { params: Promise.resolve({ indicator }) });
}

beforeEach(() => {
  getMacroIndicatorView.mockReset();
  getMacroIndicatorView.mockImplementation((indicator: string, year: number | null) => ({ indicator, selectedYear: year ?? 2026, countries: [] }));
});

describe("GET /api/macro/[indicator]", () => {
  it("returns 404 for an unknown indicator without reading any cache", async () => {
    const res = await call("gdp_per_capita", "?year=2026");
    expect(res.status).toBe(404);
    expect((await res.json()).supported).toContain("inflation");
    expect(getMacroIndicatorView).not.toHaveBeenCalled();
  });

  it("does not treat path-like input as an indicator", async () => {
    expect((await call("..%2F..%2Fpackage.json")).status).toBe(404);
    expect(getMacroIndicatorView).not.toHaveBeenCalled();
  });

  it.each(["abc", "26", "2026-01", "1989", "3000", ""])("returns 400 for invalid year %j", async year => {
    const res = await call("inflation", `?year=${year}`);
    expect(res.status).toBe(400);
    expect(getMacroIndicatorView).not.toHaveBeenCalled();
  });

  it("serves a valid request from the cache reader", async () => {
    const res = await call("real-gdp-growth", "?year=2025");
    expect(res.status).toBe(200);
    expect(getMacroIndicatorView).toHaveBeenCalledWith("real_gdp_growth", 2025);
    expect(await res.json()).toMatchObject({ indicator: "real_gdp_growth", selectedYear: 2025 });
  });

  it("passes null when no year is given (reader applies the default)", async () => {
    await call("policy_rate");
    expect(getMacroIndicatorView).toHaveBeenCalledWith("policy_rate", null);
  });

  it("returns 503 when the cache is missing", async () => {
    getMacroIndicatorView.mockReturnValue(null);
    expect((await call("unemployment", "?year=2026")).status).toBe(503);
  });
});
