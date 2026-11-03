import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { parseListingRow, parseNoticeXml, type FnetNotice } from "./fii-fnet-parser";

// Real Fundos.Net notices (contact name/phone blanked).
const FIXTURES = join(__dirname, "__fixtures__/fnet");
const fixture = (name: string) => readFileSync(join(FIXTURES, name), "utf-8");

function notice(name: string): FnetNotice {
  const parsed = parseNoticeXml(fixture(name));
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.notice;
}

describe("parseNoticeXml", () => {
  it("reads a single-quota rendimento (IRIM11, Sep-2026)", () => {
    const n = notice("irim11-1344822.xml");
    expect(n.cnpj).toBe("41076564000195");
    expect(n.informationDate).toBe("2026-10-09");
    expect(n.events).toEqual([{
      isin: "BRIRIMCTF003",
      ticker: "IRIM11",
      kind: "rendimento",
      amortizationType: null,
      baseDate: "2026-10-09",
      paymentDate: "2026-10-19",
      valuePerShare: 0.75,
      periodText: "Setembro-2026",
    }]);
  });

  it("returns one event per ISIN when a notice covers receipts too (KNCR11)", () => {
    const n = notice("kncr11-1025876.xml");
    expect(n.events).toHaveLength(9);
    expect(n.events[0]).toMatchObject({ ticker: "KNCR11", isin: "BRKNCRCTF000", valuePerShare: 1.33, periodText: "OUTUBRO 2025" });
    expect(n.events.slice(1).every(e => e.ticker !== "KNCR11")).toBe(true);
  });

  it("separates rendimento and amortização in the same Provento (VIDS11)", () => {
    const n = notice("vids11-1365813.xml");
    expect(n.events.map(e => [e.kind, e.valuePerShare, e.amortizationType])).toEqual([
      ["rendimento", 27.6954846041, null],
      ["amortizacao", 109.7208763993, "Parcial"],
    ]);
  });

  it("reads an amortização-only notice (REME11)", () => {
    const n = notice("reme11-1364168.xml");
    expect(n.events).toEqual([expect.objectContaining({ kind: "amortizacao", ticker: "REME11", valuePerShare: 10, amortizationType: "Parcial" })]);
  });

  it("handles CRLF line endings as served by FNET", () => {
    const crlf = fixture("irim11-1344822.xml").replace(/\n/g, "\r\n");
    const parsed = parseNoticeXml(crlf);
    expect(parsed.ok && parsed.notice.events[0].valuePerShare).toBe(0.75);
  });

  it("keeps an explicit zero and never coerces a malformed value", () => {
    const xml = fixture("irim11-1344822.xml");
    const zero = parseNoticeXml(xml.replace("<ValorProvento>0.75<", "<ValorProvento>0<"));
    const bad = parseNoticeXml(xml.replace("<ValorProvento>0.75<", "<ValorProvento>0,75<"));
    const empty = parseNoticeXml(xml.replace("<ValorProvento>0.75</ValorProvento>", "<ValorProvento/>"));
    expect(zero.ok && zero.notice.events[0].valuePerShare).toBe(0);
    expect(bad.ok && bad.notice.events[0].valuePerShare).toBeNull();
    expect(empty.ok && empty.notice.events[0].valuePerShare).toBeNull();
  });

  it("ignores self-closing empty event elements", () => {
    const xml = fixture("irim11-1344822.xml").replace("</Rendimento>", "</Rendimento>\n<Amortizacao tipo=\"\"/>");
    const parsed = parseNoticeXml(xml);
    expect(parsed.ok && parsed.notice.events.map(e => e.kind)).toEqual(["rendimento"]);
  });

  it("rejects the pre-2023 schema and non-notice payloads", () => {
    const legacy = `<?xml version="1.0"?><DadosEconomicoFinanceiros><DadosGerais><CNPJFundo>41076564000195</CNPJFundo>
      <CodISINCota>BRIRIMR03M17</CodISINCota></DadosGerais><InformeRendimentos><Rendimento>
      <ValorProventoCota>0.248437779</ValorProventoCota></Rendimento><Amortizacao tipo=""/></InformeRendimentos></DadosEconomicoFinanceiros>`;
    expect(parseNoticeXml(legacy)).toEqual({ ok: false, error: "unsupported schema (no Provento blocks)" });
    expect(parseNoticeXml("<html>erro</html>").ok).toBe(false);
  });
});

describe("parseListingRow", () => {
  const rows = (JSON.parse(fixture("listing-rows.json")) as { data: Record<string, unknown>[] }).data;
  const byId = (id: number) => parseListingRow(rows.find(r => r.id === id));

  it("maps listing status codes", () => {
    expect(byId(1077704)).toEqual({ id: 1077704, status: "active", version: 2, deliveredAt: "2026-01-08T18:39" });
    expect(byId(1077689)?.status).toBe("superseded");
    expect(byId(874862)?.status).toBe("cancelled");
  });

  it("rejects rows of other document types and unknown shapes", () => {
    const other = { ...rows[0], tipoDocumento: "Relatório Gerencial" };
    expect(parseListingRow(other)).toBeNull();
    expect(parseListingRow({ id: 1 })).toBeNull();
    expect(parseListingRow(null)).toBeNull();
  });

  it("flags an unknown status code instead of trusting it", () => {
    expect(parseListingRow({ ...rows[0], status: "ZZ" })?.status).toBe("unknown");
  });
});
