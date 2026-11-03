import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import {
  buildSearchUrl,
  fetchFundDistributionNotices,
  listDistributionNotices,
  type FetchLike,
} from "./fii-fnet-client";

// Never hits the live service: every request goes through a recorded fake.
const FIXTURES = join(__dirname, "__fixtures__/fnet");
const fixture = (name: string) => readFileSync(join(FIXTURES, name), "utf-8");
const listing = JSON.parse(fixture("listing-rows.json")) as { data: Record<string, unknown>[] };

function fakeFetch(routes: Record<string, string | number>): FetchLike & { calls: string[] } {
  const calls: string[] = [];
  const f = (async (url: string) => {
    calls.push(url);
    const key = Object.keys(routes).find(k => url.includes(k));
    const body = key === undefined ? 404 : routes[key];
    return typeof body === "number"
      ? { ok: false, status: body, text: async () => "" }
      : { ok: true, status: 200, text: async () => body };
  }) as FetchLike & { calls: string[] };
  f.calls = calls;
  return f;
}

const bthfRows = listing.data.filter(r => [1077689, 1077704, 874862].includes(r.id as number));
const bthfListing = JSON.stringify({ data: bthfRows, recordsTotal: bthfRows.length });

describe("FNET client", () => {
  it("searches by digits-only CNPJ with the structured distribution filters", () => {
    const url = new URL(buildSearchUrl("45188176000157", 0));
    expect(url.pathname).toBe("/fnet/publico/pesquisarGerenciadorDocumentosDados");
    expect(url.searchParams.get("cnpjFundo")).toBe("45188176000157");
    expect(url.searchParams.get("idCategoriaDocumento")).toBe("14");
    expect(url.searchParams.get("idTipoDocumento")).toBe("41");
  });

  it("downloads only active notices; superseded and cancelled come from the listing", async () => {
    const f = fakeFetch({
      pesquisarGerenciadorDocumentosDados: bthfListing,
      "id=1077704": fixture("bthf11-1077704.xml"),
    });
    const { notices } = await fetchFundDistributionNotices("45.188.176/0001-57", "2025-01-01", f, 0);
    expect(notices.map(n => [n.listing.id, n.listing.status, n.notice !== null])).toEqual([
      [1077704, "active", true],
      [1077689, "superseded", false],
      [874862, "cancelled", false],
    ]);
    expect(f.calls.filter(u => u.includes("downloadDocumento"))).toHaveLength(1);
  });

  it("stops at notices delivered before the requested date", async () => {
    const f = fakeFetch({ pesquisarGerenciadorDocumentosDados: bthfListing });
    const { notices } = await listDistributionNotices("45188176000157", "2025-06-01", f);
    expect(notices.map(n => n.id)).toEqual([1077704, 1077689]);
  });

  it("records a failed document download per notice instead of throwing", async () => {
    const f = fakeFetch({ pesquisarGerenciadorDocumentosDados: bthfListing, "id=1077704": 503 });
    const { notices } = await fetchFundDistributionNotices("45188176000157", "2025-01-01", f, 0);
    expect(notices[0]).toMatchObject({ notice: null, error: "FNET document 1077704 HTTP 503" });
  });

  it("throws when the listing is unavailable or changes shape", async () => {
    await expect(listDistributionNotices("1", "2025-01-01", fakeFetch({}))).rejects.toThrow("HTTP 404");
    await expect(listDistributionNotices("1", "2025-01-01", fakeFetch({ pesquisar: "{\"rows\":[]}" })))
      .rejects.toThrow("unexpected payload");
  });
});
