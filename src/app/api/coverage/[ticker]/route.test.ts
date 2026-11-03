import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { GET as coverageGET } from "./route";
import { GET as bankGET } from "../../banks/analysis/[ticker]/route";

type Handler = (req: NextRequest, ctx: { params: Promise<{ ticker: string }> }) => Promise<Response>;

function call(handler: Handler, path: string, ticker: string) {
  return handler(new NextRequest(`http://localhost${path}${ticker}`), { params: Promise.resolve({ ticker }) });
}

describe("GET /api/coverage/[ticker] — readiness/lifecycle/alias (backward compatible)", () => {
  it("keeps the existing coverage object and adds alias + readiness for ITUB3", async () => {
    const body = await (await call(coverageGET, "/api/coverage/", "ITUB3")).json();
    expect(body.coverage.ticker).toBe("ITUB3");
    expect(body.fundamentalsAlias).toEqual({ requestedTicker: "ITUB3", fundamentalsTicker: "ITUB4", reason: "same_issuer_share_class" });
    expect(body.readiness).toMatchObject({ ticker: "ITUB3", readiness: "analysis_ready", fundamentalsTicker: "ITUB4" });
    expect(body.lifecycle).toEqual({ ticker: "ITUB3", status: "active" });
  });

  it("exposes the successor of a historical ticker", async () => {
    const body = await (await call(coverageGET, "/api/coverage/", "RRRP3")).json();
    expect(body.coverage.coverageLevel).toBe("unavailable");
    expect(body.lifecycle).toMatchObject({ status: "renamed", successorTicker: "BRAV3" });
    expect(body.readiness.readiness).toBe("historical_or_unavailable");
  });

  it("returns readiness null for tickers outside the universe", async () => {
    const body = await (await call(coverageGET, "/api/coverage/", "ZZZZ3")).json();
    expect(body.readiness).toBeNull();
    expect(body.fundamentalsAlias).toBeNull();
  });
});

describe("GET /api/banks/analysis/[ticker] — share-class alias", () => {
  it("ITUB3 serves ITUB4 fundamentals but keeps the requested ticker", async () => {
    const body = await (await call(bankGET, "/api/banks/analysis/", "ITUB3")).json();
    expect(body.available).toBe(true);
    expect(body.ticker).toBe("ITUB3");
    expect(body.company.ticker).toBe("ITUB3");
    expect(body.fundamentalsAlias.fundamentalsTicker).toBe("ITUB4");
  });

  it("ITSA4 is not served by a bank cache", async () => {
    const body = await (await call(bankGET, "/api/banks/analysis/", "ITSA4")).json();
    expect(body.available).toBe(false);
  });
});

describe("GET /api/forecasting/time-series/[ticker] — ticker-change alias", () => {
  it("EMBJ3 reads the EMBR3 cache but answers as EMBJ3", async () => {
    const { GET } = await import("../../forecasting/time-series/[ticker]/route");
    const res = await GET(new Request("http://localhost/api/forecasting/time-series/EMBJ3"), { params: Promise.resolve({ ticker: "EMBJ3" }) });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ticker).toBe("EMBJ3");
    expect(body.fundamentalsAlias).toMatchObject({ fundamentalsTicker: "EMBR3", reason: "same_issuer_ticker_change" });
  });
});
