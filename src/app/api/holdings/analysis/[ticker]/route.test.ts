import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

function call(ticker: string) {
  return GET(new NextRequest(`http://localhost/api/holdings/analysis/${ticker}`), { params: Promise.resolve({ ticker }) });
}

describe("GET /api/holdings/analysis/[ticker]", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("ITSA3 is served from the ITSA4 issuer cache, keeping the requested ticker", async () => {
    const res = await call("itsa3");
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ available: true, requestedTicker: "ITSA3", canonicalTicker: "ITSA4" });
    expect(body.requestedShareClass.ticker).toBe("ITSA3");
    expect(body.portfolio.officialPortfolioValue).toBe(199_950_000_000);
  });

  it("BRAP3 is served from the BRAP4 issuer cache", async () => {
    const body = await (await call("BRAP3")).json();
    expect(body).toMatchObject({ available: true, requestedTicker: "BRAP3", canonicalTicker: "BRAP4" });
    expect(body.portfolio.publishedNetCash.value).toBe(511_033_000);
    expect(body.statement.netDebt).toBe(-254_451_000);
  });

  it("ITSA4 and BRAP4 resolve to themselves", async () => {
    for (const t of ["ITSA4", "BRAP4"]) {
      expect((await (await call(t)).json()).canonicalTicker).toBe(t);
    }
  });

  it("unsupported tickers (including Itaú Unibanco and Vale) → 404, available:false", async () => {
    for (const t of ["ITUB4", "VALE3", "CSAN3", "GOAU4", "ZZZZ3"]) {
      const res = await call(t);
      expect(res.status, t).toBe(404);
      expect(await res.json(), t).toMatchObject({ available: false, reason: "unsupported_ticker" });
    }
  });

  it("reads committed cache only — no network access at request time", async () => {
    const fetchSpy = vi.fn(() => { throw new Error("network access in request path"); });
    vi.stubGlobal("fetch", fetchSpy);
    const body = await (await call("BRAP4")).json();
    expect(body.available).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("missing ticker → 400", async () => {
    expect((await call("--")).status).toBe(400);
  });
});
