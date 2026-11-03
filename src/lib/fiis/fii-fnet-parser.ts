// Pure parsers for B3 Fundos.Net (FNET) "Aviso aos Cotistas - Estruturado /
// Rendimentos e Amortizações" notices. No network — see fii-fnet-client.ts.
//
// Two payloads are parsed:
//   1. the search listing (JSON rows from pesquisarGerenciadorDocumentosDados),
//      which carries the document status (active / superseded / cancelled)
//      and version — the XML itself does not;
//   2. the notice XML (downloadDocumento), schema observed on every notice
//      filed since 2024:
//
//   <DadosEconomicoFinanceiros>
//     <DadosGerais><CNPJFundo>…</CNPJFundo><DataInformacao>…</DataInformacao>…</DadosGerais>
//     <InformeRendimentos>
//       <Provento>                         one per ISIN (quota, receipts…)
//         <CodISIN>…</CodISIN><CodNegociacao>…</CodNegociacao>
//         <Rendimento>…</Rendimento>       optional, cash distribution
//         <Amortizacao tipo="Parcial">…</Amortizacao>   optional
//       </Provento>
//     </InformeRendimentos>
//   </DadosEconomicoFinanceiros>
//
// Each event block holds DataBase, DataPagamento, ValorProvento and a free-text
// PeriodoReferencia. The pre-2023 schema (ISIN in DadosGerais, ValorProventoCota)
// is rejected as unsupported rather than guessed.

export type FnetNoticeStatus = "active" | "superseded" | "cancelled" | "unknown";

export interface FnetNoticeListing {
  id: number;
  status: FnetNoticeStatus;
  version: number;
  // "dd/mm/yyyy hh:mm" from the listing, as "yyyy-mm-ddThh:mm".
  deliveredAt: string;
}

export type FnetEventKind = "rendimento" | "amortizacao";

export interface FnetDistributionEvent {
  isin: string;
  ticker: string;
  kind: FnetEventKind;
  // Amortizacao tipo attribute ("Parcial" / "Total"); null for rendimento.
  amortizationType: string | null;
  baseDate: string | null;
  paymentDate: string | null;
  valuePerShare: number | null;
  periodText: string;
}

export interface FnetNotice {
  cnpj: string;
  informationDate: string | null;
  events: FnetDistributionEvent[];
}

export type ParsedFnetNotice =
  | { ok: true; notice: FnetNotice }
  | { ok: false; error: string };

// Listing labels the search filters on; anything else is a format change.
export const FNET_DISTRIBUTION_CATEGORY = "Aviso aos Cotistas - Estruturado";
export const FNET_DISTRIBUTION_TYPE = "Rendimentos e Amortizações";

// ── Listing ───────────────────────────────────────────────────────────────────

// AC = "Ativo com visualização", IC = "Inativo com visualização" (replaced by a
// reapresentação), CC = "Cancelado com visualização".
const STATUS_BY_CODE: Record<string, FnetNoticeStatus> = {
  AC: "active",
  IC: "superseded",
  CC: "cancelled",
};

function parseDeliveredAt(s: unknown): string | null {
  const m = typeof s === "string" ? /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/.exec(s.trim()) : null;
  return m ? `${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}` : null;
}

export function parseListingRow(row: unknown): FnetNoticeListing | null {
  if (typeof row !== "object" || row === null) return null;
  const r = row as Record<string, unknown>;
  if (r.categoriaDocumento !== FNET_DISTRIBUTION_CATEGORY) return null;
  if (typeof r.tipoDocumento !== "string" || r.tipoDocumento.trim() !== FNET_DISTRIBUTION_TYPE) return null;
  const id = typeof r.id === "number" && Number.isInteger(r.id) ? r.id : null;
  const deliveredAt = parseDeliveredAt(r.dataEntrega);
  if (id === null || deliveredAt === null) return null;
  const code = typeof r.status === "string" ? r.status : "";
  return {
    id,
    status: STATUS_BY_CODE[code] ?? "unknown",
    version: typeof r.versao === "number" ? r.versao : 1,
    deliveredAt,
  };
}

// ── XML ───────────────────────────────────────────────────────────────────────

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, "&");
}

// Text of the first <tag>…</tag> in `xml`; null when absent or self-closing.
function tagText(xml: string, tag: string): string | null {
  const m = new RegExp(`<${tag}(?:\\s[^>]*)?(?<!/)>([\\s\\S]*?)</${tag}>`).exec(xml);
  return m ? decodeEntities(m[1]).trim() : null;
}

// Every <tag …>…</tag> block, with its attribute string. Self-closing tags
// (<Amortizacao tipo=""/>) are empty elements and never match.
function blocks(xml: string, tag: string): { attrs: string; body: string }[] {
  const re = new RegExp(`<${tag}(\\s[^>]*?)?(?<!/)>([\\s\\S]*?)</${tag}>`, "g");
  const out: { attrs: string; body: string }[] = [];
  for (let m = re.exec(xml); m; m = re.exec(xml)) out.push({ attrs: m[1] ?? "", body: m[2] });
  return out;
}

function attr(attrs: string, name: string): string | null {
  const m = new RegExp(`${name}="([^"]*)"`).exec(attrs);
  return m ? decodeEntities(m[1]).trim() : null;
}

function isoDate(s: string | null): string | null {
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

// Values are dot-decimal ("0.75", "27.6954846041"). Anything else is null,
// never coerced; an explicit "0" stays 0.
function parseValue(s: string | null): number | null {
  if (s === null || !/^\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}

function parseEvent(
  isin: string,
  ticker: string,
  kind: FnetEventKind,
  attrs: string,
  body: string,
): FnetDistributionEvent {
  return {
    isin,
    ticker,
    kind,
    amortizationType: kind === "amortizacao" ? attr(attrs, "tipo") || null : null,
    baseDate: isoDate(tagText(body, "DataBase")),
    paymentDate: isoDate(tagText(body, "DataPagamento")),
    valuePerShare: parseValue(tagText(body, "ValorProvento")),
    periodText: tagText(body, "PeriodoReferencia") ?? "",
  };
}

export function parseNoticeXml(xml: string): ParsedFnetNotice {
  if (!/<DadosEconomicoFinanceiros[\s>]/.test(xml)) return { ok: false, error: "not a DadosEconomicoFinanceiros document" };
  const general = tagText(xml, "DadosGerais");
  const cnpj = general ? tagText(general, "CNPJFundo")?.replace(/\D/g, "") ?? "" : "";
  if (cnpj.length !== 14) return { ok: false, error: "missing CNPJFundo" };

  const report = tagText(xml, "InformeRendimentos");
  if (report === null) return { ok: false, error: "missing InformeRendimentos" };
  const proventos = blocks(report, "Provento");
  if (proventos.length === 0) return { ok: false, error: "unsupported schema (no Provento blocks)" };

  const events: FnetDistributionEvent[] = [];
  for (const { body } of proventos) {
    const isin = tagText(body, "CodISIN") ?? "";
    const ticker = tagText(body, "CodNegociacao") ?? "";
    for (const b of blocks(body, "Rendimento")) events.push(parseEvent(isin, ticker, "rendimento", b.attrs, b.body));
    for (const b of blocks(body, "Amortizacao")) events.push(parseEvent(isin, ticker, "amortizacao", b.attrs, b.body));
  }
  return {
    ok: true,
    notice: { cnpj, informationDate: isoDate(general ? tagText(general, "DataInformacao") : null), events },
  };
}
