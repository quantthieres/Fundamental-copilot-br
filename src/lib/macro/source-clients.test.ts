import { describe, it, expect, afterEach, vi } from "vitest";
import { buildWeoDataUrl, fetchWeo, parseWeoStructureSpecificXml, latestActualKey } from "./weo-client";
import { buildBisPolicyRateUrl, fetchBisPolicyRates, parseBisPolicyRateCsv, parseCsv } from "./bis-client";
import { fetchTextWithRetry } from "./macro-http";
import { BIS_CSV_FIXTURE, WEO_XML_FIXTURE } from "./macro-test-fixtures";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("IMF WEO client", () => {
  it("builds the SDMX data URL from indicator codes", () => {
    expect(buildWeoDataUrl(["PCPIPCH", "LUR"], 2000)).toBe(
      "https://api.imf.org/external/sdmx/2.1/data/IMF.RES,WEO/.PCPIPCH+LUR.A?startPeriod=2000",
    );
    expect(() => buildWeoDataUrl([], 2000)).toThrow();
    expect(() => buildWeoDataUrl(["LUR&x=1"], 2000)).toThrow(/invalid indicator/);
  });

  it("parses header, groups, series and observations", () => {
    const parsed = parseWeoStructureSpecificXml(WEO_XML_FIXTURE);
    expect(parsed.dataflow).toBe("IMF.RES:WEO(9.0.0)");
    expect(parsed.publicationDate).toBe("2026-10-13T02:00:00Z");
    expect(parsed.series.map(s => `${s.country}.${s.indicator}`)).toEqual([
      "BRA.PCPIPCH", "IND.PCPIPCH", "KOS.PCPIPCH", "TWN.PCPIPCH", "G001.PCPIPCH", "GX123.PCPIPCH", "BRA.LUR",
    ]);
    const bra = parsed.series[0];
    expect(bra.frequency).toBe("A");
    expect(bra.observations).toEqual([
      { period: "1999", value: "9.9" },
      { period: "2024", value: "1.25" },
      { period: "2025", value: "2.5" },
      { period: "2026", value: "3.75" },
      { period: "2027", value: "4" },
    ]);
    // Observation without OBS_VALUE is kept as missing.
    expect(parsed.series[1].observations[2]).toEqual({ period: "2026", value: undefined });
    expect(parsed.latestActual.get(latestActualKey("BRA", "PCPIPCH"))).toBe("2025");
    expect(parsed.latestActual.get(latestActualKey("IND", "PCPIPCH"))).toBe("FY2024/25");
    expect(parsed.latestActual.has(latestActualKey("TWN", "PCPIPCH"))).toBe(false);
  });

  it("rejects non-SDMX and malformed payloads", () => {
    expect(() => parseWeoStructureSpecificXml("<html>blocked</html>")).toThrow(/not SDMX/);
    expect(() => parseWeoStructureSpecificXml("<message:Error><x/></message:Error>")).toThrow(/error message/);
    expect(() => parseWeoStructureSpecificXml(
      `<message:StructureSpecificData><Obs TIME_PERIOD="2020" OBS_VALUE="1"/></message:StructureSpecificData>`,
    )).toThrow(/outside <Series>/);
  });

  it("fetches with mocked network", async () => {
    const fetchMock = vi.fn(async () => new Response(WEO_XML_FIXTURE, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const parsed = await fetchWeo(["PCPIPCH"], 2000);
    expect(parsed.series.length).toBe(7);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("BIS policy-rate client", () => {
  it("builds the monthly SDMX URL", () => {
    expect(buildBisPolicyRateUrl(2000)).toBe(
      "https://stats.bis.org/api/v2/data/dataflow/BIS/WS_CBPOL/1.0/M.*?startPeriod=2000-01",
    );
  });

  it("parses RFC 4180 CSV with quoted commas, escaped quotes and CRLF", () => {
    expect(parseCsv('a,"b,c","d ""e"""\r\n1,2,3\n')).toEqual([["a", "b,c", 'd "e"'], ["1", "2", "3"]]);
    expect(parseCsv("")).toEqual([]);
    expect(() => parseCsv('a,"open')).toThrow(/unterminated/);
  });

  it("parses the SDMX-CSV response into raw observations", () => {
    const rows = parseBisPolicyRateCsv(BIS_CSV_FIXTURE);
    expect(rows).toHaveLength(8);
    expect(rows[0]).toEqual({
      freq: "M", refArea: "BR", period: "2024-11", value: "10.5", obsStatus: "A", unitMeasure: "368", unitMult: "0",
    });
    expect(rows.find(r => r.refArea === "US" && r.period === "2025-12")).toMatchObject({ value: "NaN", obsStatus: "M" });
  });

  it("rejects a response without the required columns", () => {
    expect(() => parseBisPolicyRateCsv("FREQ,REF_AREA\nM,BR\n")).toThrow(/missing column TIME_PERIOD/);
    expect(() => parseBisPolicyRateCsv("")).toThrow(/Empty/);
  });

  it("fetches with mocked network and the SDMX-CSV Accept header", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(BIS_CSV_FIXTURE, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const rows = await fetchBisPolicyRates(2000);
    expect(rows).toHaveLength(8);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Accept).toContain("sdmx.data+csv");
  });
});

describe("fetchTextWithRetry", () => {
  it("retries and finally throws on HTTP errors (network failure is fatal)", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () => new Response("down", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    const p = fetchTextWithRetry("https://example.invalid/x", { retries: 2 });
    const assertion = expect(p).rejects.toThrow(/HTTP 503/);
    await vi.runAllTimersAsync();
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("returns the body after a transient failure", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error("ECONNRESET"))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const p = fetchTextWithRetry("https://example.invalid/x", { retries: 1 });
    await vi.runAllTimersAsync();
    await expect(p).resolves.toBe("ok");
  });
});
