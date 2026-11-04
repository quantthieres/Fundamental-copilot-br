import { describe, expect, it } from "vitest";
import { fixtureBytes, fixtureText } from "./__fixtures__/fixtures";
import {
  bulletinToPortfolio,
  latestBulletinFromListing,
  parseBulletinText,
  validateBulletin,
  type BulletinListing,
} from "./bradespar-bulletin";
import { extractBulletinText } from "./bradespar-pdf-text";
import { fetchBradesparPortfolio, type FetchLike } from "./holding-portfolio-sources";

// Official bulletin "BQ - 03/11/2026" (closing prices of 30/10/2026) and its
// AEM listing — recorded fixtures, no network.
const PDF = "bradespar-bq-2026-11-03.pdf";
const TEXT = fixtureText("bradespar-bq-2026-11-03.txt");
const LISTING = JSON.parse(fixtureText("bradespar-bq-listing.json"));
const latest: BulletinListing = latestBulletinFromListing(LISTING);

describe("Bradespar bulletin discovery", () => {
  it("picks the latest BQ entry of the official listing", () => {
    expect(latest).toEqual({
      title: "BQ - 03/11/2026",
      fileDate: "2026-11-03",
      pdfPath: "/content/dam/banco-bradesco/bradespar/staticfiles/assets/pdf/boletim-quinzenal/2026/BQ_2026_03.11.2026_PORT-1.pdf",
      pdfUrl: "https://publish-p128342-e1259725.adobeaemcloud.com/content/dam/banco-bradesco/bradespar/staticfiles/assets/pdf/boletim-quinzenal/2026/BQ_2026_03.11.2026_PORT-1.pdf",
    });
  });

  it("ignores English newsletters and entries without a file, and rejects other payloads", () => {
    const items = LISTING.data.bradesparArquivoList.items.filter((i: { title: string }) => !i.title.startsWith("BQ - "));
    const only = { data: { bradesparArquivoList: { items } } };
    expect(() => latestBulletinFromListing(only)).toThrow("no bulletin entries");
    expect(() => latestBulletinFromListing({ rows: [] })).toThrow("unexpected payload");
  });
});

describe("PDF text extraction (real official PDF)", () => {
  it("extracts the embedded text layer of the one-page bulletin", async () => {
    const text = await extractBulletinText(fixtureBytes(PDF));
    expect(text.trim()).toBe(TEXT.trim());
  });

  it("rejects non-PDF input", async () => {
    await expect(extractBulletinText(new TextEncoder().encode("<html>erro</html>"))).rejects.toThrow("not a PDF");
  });
});

describe("bulletin parser", () => {
  const b = parseBulletinText(TEXT);

  it("reads every expected field", () => {
    expect(b).toMatchObject({
      bulletinDate: "2026-11-03",
      priceReferenceDate: "2026-10-30",
      netCashReferenceDate: "2026-10-30",
      holdings: [{ label: "VALE ON", price: 62.02, shares: 163_354_595, ownershipPctPublished: 0.0384, ownershipText: "3,84%", valueThousands: 10_131_252 }],
      totalAssetsThousands: 10_131_252,
      netCashThousands: 511_033,
      navThousands: 10_642_285,
      marketValueThousands: 7_014_908,
      classes: [
        { ticker: "BRAP3", price: 17.06, shares: 137_989_898, valueThousands: 2_354_108 },
        { ticker: "BRAP4", price: 18.27, shares: 255_106_712, valueThousands: 4_660_800 },
      ],
      differenceThousands: 3_627_377,
      discountText: "34,1%",
      discountMagnitude: 0.341,
    });
  });

  it("passes every arithmetic check", () => {
    const checks = validateBulletin(b);
    expect(checks.every(c => c.passed)).toBe(true);
    expect(checks.map(c => c.name)).toEqual([
      "VALE ON: value = shares × price",
      "total assets (A) = Σ investees",
      "NAV (C) = (A) + net cash (B)",
      "BRAP3: value = shares × price",
      "BRAP4: value = shares × price",
      "market value (D) = Σ class price × class shares",
      "difference = (C) − (D)",
      "discount = (D) / (C) − 1 (published magnitude)",
    ]);
  });

  it("builds the portfolio: Vale valued from the share quantity, 3.84% kept as published", () => {
    const r = bulletinToPortfolio(b, latest);
    if (!r.ok) throw new Error(r.error);
    const p = r.portfolio;
    expect(p.components[0]).toMatchObject({
      name: "Vale", ticker: "VALE3", listed: true, valueBasis: "market_price", valueReferenceDate: "2026-10-30",
      sharesHeld: 163_354_595, pricePerShare: 62.02, value: 10_131_252_000, ownershipPct: 0.0384,
    });
    expect(p.components[1]).toMatchObject({ kind: "net_cash", valueBasis: "net_cash", value: 511_033_000, valueReferenceDate: "2026-10-30" });
    expect(p.publishedNetCash).toEqual({ value: 511_033_000, referenceDate: "2026-10-30", source: latest.pdfUrl, usage: "input_to_official_portfolio_value" });
    expect(p.components[0].value + p.publishedNetCash!.value).toBe(p.officialPortfolioValue);
    expect(p.officialPortfolioValue).toBe(10_642_285_000);
    expect(p.officialMarketValue).toMatchObject({ value: 7_014_908_000, method: "class_price_times_class_shares_sum", priceReferenceDate: "2026-10-30" });
    expect(p.officialDiscount).toEqual({ value: -0.341, published: "34,1%", formula: "officialMarketValue / officialPortfolioValue - 1",
      signConvention: "published_as_positive_discount_magnitude" });
    expect(p.standardizedClassWeightedMarketCap).toBeCloseTo(17.06 * 137_989_898 + 18.27 * 255_106_712, 2);
    expect(p.diagnostics[0]).toMatch(/3\.84%.*not used for any calculation/);
    expect(r.warnings).toEqual([]);
  });

  it("rejects a bulletin whose stake value does not match quantity × price", () => {
    const bad = TEXT.replace("VALE ON 62,02 163.354.595", "VALE ON 64,02 163.354.595");
    const r = bulletinToPortfolio(parseBulletinText(bad), latest);
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/VALE ON: value = shares × price/) });
  });

  it("rejects an inconsistent NAV, market value or discount", () => {
    expect(bulletinToPortfolio(parseBulletinText(TEXT.replace("( B ) (1) 511.033", "( B ) (1) 611.033")), latest).ok).toBe(false);
    expect(bulletinToPortfolio(parseBulletinText(TEXT.replace("(BRAP4) 18,27", "(BRAP4) 19,27")), latest).ok).toBe(false);
    expect(bulletinToPortfolio(parseBulletinText(TEXT.replace("DESCONTO (2) 34,1%", "DESCONTO (2) 30,1%")), latest).ok).toBe(false);
  });

  it("rejects malformed bulletins", () => {
    expect(() => parseBulletinText(TEXT.replace("BOLETIM DE RELAÇÕES COM INVESTIDORES", "OUTRO DOCUMENTO"))).toThrow(/header/);
    expect(() => parseBulletinText(TEXT.replace(/^Ações Preferenciais \(BRAP4\).*$/m, ""))).toThrow(/BRAP4/);
    expect(() => parseBulletinText(TEXT.replace("(3) Não considera ações em tesouraria", ""))).toThrow(/share-count footnote/);
    expect(() => parseBulletinText(TEXT.replace("- 1\n(3)", "\n(3)"))).toThrow(/discount formula/);
    expect(() => parseBulletinText(TEXT.replace("VALE ON 62,02", "VALE ON n/d"))).toThrow(/unexpected investee row/);
  });

  it("rejects a bulletin dated differently from its listing entry", () => {
    expect(bulletinToPortfolio(b, { ...latest, fileDate: "2026-10-16" })).toMatchObject({ ok: false });
  });
});

describe("fetchBradesparPortfolio (fake network)", () => {
  const fake = (routes: Record<string, number | (() => Promise<string | ArrayBuffer>)>): FetchLike => async url => {
    const key = Object.keys(routes).find(k => url.includes(k));
    const r = key ? routes[key] : 404;
    if (typeof r === "number") return { ok: false, status: r, text: async () => "", arrayBuffer: async () => new ArrayBuffer(0) };
    const body = await r();
    return {
      ok: true, status: 200,
      text: async () => (typeof body === "string" ? body : ""),
      arrayBuffer: async () => (typeof body === "string" ? new ArrayBuffer(0) : body),
    };
  };
  const pdfBuffer = async () => fixtureBytes(PDF).slice().buffer as ArrayBuffer;

  it("discovers, downloads, extracts and validates the latest bulletin", async () => {
    const r = await fetchBradesparPortfolio(fake({ "execute.json": async () => JSON.stringify(LISTING), "PORT-1.pdf": pdfBuffer }));
    expect(r.ok && r.value.portfolio.officialPortfolioValue).toBe(10_642_285_000);
  });

  it("reports source failures instead of throwing", async () => {
    expect(await fetchBradesparPortfolio(fake({ "execute.json": 503 }))).toEqual({ ok: false, error: "Bradespar bulletin listing HTTP 503" });
    const r = await fetchBradesparPortfolio(fake({ "execute.json": async () => JSON.stringify(LISTING), "PORT-1.pdf": 404 }));
    expect(r).toEqual({ ok: false, error: "Bradespar bulletin BQ - 03/11/2026 HTTP 404" });
  });
});
