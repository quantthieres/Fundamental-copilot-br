import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const getMacroCountrySnapshot = vi.fn();

vi.mock("@/lib/macro/macro-cache", async importOriginal => {
  const actual = await importOriginal<typeof import("@/lib/macro/macro-cache")>();
  return { ...actual, getMacroCountrySnapshot: (...args: unknown[]) => getMacroCountrySnapshot(...args) };
});

const { GET } = await import("./route");

function call(iso3: string, query = "") {
  const req = new NextRequest(`http://localhost/api/macro/country/${iso3}${query}`);
  return GET(req, { params: Promise.resolve({ iso3 }) });
}

beforeEach(() => {
  getMacroCountrySnapshot.mockReset();
  getMacroCountrySnapshot.mockImplementation((iso3: string, year: number) => ({ iso3, selectedYear: year, indicators: [] }));
});

describe("GET /api/macro/country/[iso3]", () => {
  it("returns the snapshot for a known country (case-insensitive)", async () => {
    const res = await call("bra", "?year=2026");
    expect(res.status).toBe(200);
    expect(getMacroCountrySnapshot).toHaveBeenCalledWith("BRA", 2026);
  });

  it("returns 404 for unknown or malformed countries without reading caches", async () => {
    for (const bad of ["ZZZ", "Brasil", "BR", "..%2Fx"]) {
      expect((await call(bad, "?year=2026")).status).toBe(404);
    }
    expect(getMacroCountrySnapshot).not.toHaveBeenCalled();
  });

  it("requires a valid year", async () => {
    expect((await call("BRA")).status).toBe(400);
    expect((await call("BRA", "?year=abc")).status).toBe(400);
    expect((await call("BRA", "?year=1800")).status).toBe(400);
    expect(getMacroCountrySnapshot).not.toHaveBeenCalled();
  });
});
