// Itaúsa official portfolio ("Valor do Portfólio e Desconto").
//
// Source: https://ri.itausa.com.br/informacoes-financeiras/valor-do-portfolio-e-desconto/
// — a server-rendered HTML table (R$ millions) with footnotes (A)–(G) that
// state each line's valuation basis and dates. The snapshot is stored exactly
// as published: values, ownership, "Demais Ativos e Passivos", the issuer's
// market value (most liquid class price × all shares ex-treasury) and its
// discount. Nothing is reconstructed from CVM.
//
// Precompute time only. No @/ imports — also used by tsx scripts.

import type {
  HoldingPortfolio,
  HoldingPortfolioComponent,
  MixedBasisPart,
  PortfolioValueBasis,
  ValidationCheck,
} from "./holding-types";
import {
  check,
  parseBrDate,
  parseBrNumber,
  parseBrPercent,
  productTolerance,
  type PortfolioParseResult,
} from "./holding-portfolio-validation";

export const ITAUSA_PORTFOLIO_URL = "https://ri.itausa.com.br/informacoes-financeiras/valor-do-portfolio-e-desconto/";

/** Components published on 2026-10-15. A change is reported, never dropped. */
export const EXPECTED_ITAUSA_COMPONENTS = [
  "Itaú Unibanco", "Dexco", "Alpargatas", "Motiva", "Aegea", "Copa Energia", "NTS",
] as const;

const MILLION = 1_000_000;

interface Cell { text: string; notes: string[] }

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

function cellOf(html: string): Cell {
  const notes = [...html.matchAll(/<sup>\s*\(([A-Z])\)\s*<\/sup>/g)].map(m => m[1]);
  const text = decodeEntities(
    html.replace(/<sup>[\s\S]*?<\/sup>/g, "").replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, ""),
  ).replace(/\s+/g, " ").trim();
  return { text, notes };
}

function normalize(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

function rowsOf(tableHtml: string): Cell[][] {
  return [...tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)]
    .map(m => [...m[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map(c => cellOf(c[1])));
}

const EXPECTED_HEADERS = [
  "cotacao da acao mais liquida (r$)",
  "total de acoes (milhoes)",
  "valor de mercado (r$ milhoes)",
  "participacao da itausa (%)",
  "valor de mercado das participacoes (r$ milhoes)",
];

function footnotesOf(html: string): Map<string, string> {
  const block = /class="s2__disclaimers"[\s\S]*?<\/div>/.exec(html)?.[0] ?? "";
  const text = decodeEntities(block.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, ""));
  const notes = new Map<string, string>();
  for (const m of text.matchAll(/^\s*\(([A-Z])\)\s*(.+?)\s*$/gm)) notes.set(m[1], m[2].replace(/\s+/g, " "));
  return notes;
}

function dateIn(text: string): string | null {
  const m = /(\d{2}\.\d{2}\.\d{4})/.exec(text);
  return m ? parseBrDate(m[1]) : null;
}

function millions(text: string): number | null {
  const m = /R\$\s*([\d.,]+)\s*milh/.exec(text);
  const n = m ? parseBrNumber(m[1]) : null;
  return n === null ? null : n;
}

interface BasisResult {
  basis: PortfolioValueBasis;
  referenceDate: string | null;
  parts: MixedBasisPart[] | null;
}

/** Valuation basis from a component footnote; "unclassified" when unrecognized. */
export function classifyItausaFootnote(note: string): BasisResult {
  const n = normalize(note);
  const split = /\(ii\)/.exec(note);
  if (split && /aumento de capital/.test(n) && /saldo contabil/.test(n)) {
    const first = note.slice(0, split.index);
    const second = note.slice(split.index);
    const tx = millions(first);
    const book = millions(second);
    const bookDate = dateIn(second);
    if (tx !== null && book !== null) {
      return {
        basis: "mixed_transaction_and_book",
        referenceDate: null,
        parts: [
          { basis: "transaction_price", value: tx * MILLION, referenceDate: null, description: first.replace(/^.*?\(i\)\s*/, "").replace(/[;\s]+e\s*$/, "").trim() },
          { basis: "book_value", value: book * MILLION, referenceDate: bookDate, description: second.replace(/^\(ii\)\s*/, "").replace(/\.$/, "").trim() },
        ],
      };
    }
  }
  if (/balanco individual/.test(n)) return { basis: "other_assets_liabilities", referenceDate: dateIn(note), parts: null };
  if (/valor justo contabilizado/.test(n)) return { basis: "booked_fair_value", referenceDate: dateIn(note), parts: null };
  if (/valor do investimento contabilizado|valor contabil/.test(n)) return { basis: "book_value", referenceDate: dateIn(note), parts: null };
  return { basis: "unclassified", referenceDate: dateIn(note), parts: null };
}

/** "…do Itaú Unibanco (ITUB4), Dexco (DXCO3)…" → ticker for a component name. */
function tickerFor(name: string, priceNote: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = new RegExp(`${escaped}\\s*\\(([A-Z]{4}\\d{1,2})\\)`).exec(priceNote);
  return m ? m[1] : null;
}

export function parseItausaPortfolioHtml(html: string, url = ITAUSA_PORTFOLIO_URL): PortfolioParseResult {
  const warnings: string[] = [];
  const section = html.indexOf("pageValorPortfolio");
  if (section < 0) return { ok: false, error: "portfolio section not found" };
  const tableMatch = /<table[\s\S]*?<\/table>/.exec(html.slice(section));
  if (!tableMatch) return { ok: false, error: "portfolio table not found" };
  const rows = rowsOf(tableMatch[0]);
  if (rows.length < 4) return { ok: false, error: "portfolio table too short" };

  const header = rows[0].map(c => normalize(c.text));
  if (header.length !== 6 || EXPECTED_HEADERS.some((h, i) => header[i + 1] !== h)) {
    return { ok: false, error: `unexpected table header: ${header.join(" | ")}` };
  }
  if (rows.some(r => r.length !== 6)) return { ok: false, error: "row with unexpected column count" };

  const notes = footnotesOf(html);
  const priceNote = notes.get("A");
  const sharesNote = notes.get("B");
  const ownershipNote = notes.get("C");
  if (!priceNote || !/cotacoes de fechamento/.test(normalize(priceNote))) return { ok: false, error: "footnote (A) price date missing" };
  if (!sharesNote || !/emitidas menos acoes em tesouraria/.test(normalize(sharesNote))) return { ok: false, error: "footnote (B) share basis changed" };
  const priceDate = dateIn(priceNote);
  if (!priceDate) return { ok: false, error: "footnote (A) price date unreadable" };
  const ownershipDate = ownershipNote ? dateIn(ownershipNote) : null;
  if (!ownershipDate) warnings.push("footnote (C) ownership date not found");

  const components: HoldingPortfolioComponent[] = [];
  const checks: ValidationCheck[] = [];
  let total: number | null = null;
  let market: { price: number; shares: number; value: number; ticker: string | null } | null = null;
  let discountText: string | null = null;

  for (const row of rows.slice(1)) {
    const [label, priceCell, sharesCell, mvCell, pctCell, valueCell] = row;
    const key = normalize(label.text);
    const value = parseBrNumber(valueCell.text);

    if (key.startsWith("valor do portfolio")) {
      if (value === null) return { ok: false, error: "portfolio total unreadable" };
      total = value;
      continue;
    }
    if (key.startsWith("valor de mercado da itausa")) {
      const price = parseBrNumber(priceCell.text);
      const shares = parseBrNumber(sharesCell.text);
      const mv = parseBrNumber(mvCell.text);
      if (price === null || shares === null || mv === null || value === null) return { ok: false, error: "Itaúsa market value row unreadable" };
      checks.push(check("itausa_market_value_columns_agree", value, mv, 0));
      checks.push(check("itausa_market_value = price × shares", mv, price * shares, productTolerance(price, 0.005, shares, 0.5, 0.5)));
      market = { price, shares, value: mv, ticker: tickerFor("Itaúsa", priceNote) };
      continue;
    }
    if (key === "desconto") {
      discountText = valueCell.text;
      continue;
    }
    if (value === null) return { ok: false, error: `value unreadable for "${label.text}"` };

    const notesText = label.notes.map(l => notes.get(l)).filter((t): t is string => !!t);
    const source = `${url}#${label.notes.join(",")}`.replace(/#$/, "");

    if (key.startsWith("demais ativos e passivos")) {
      const basis = notesText.length ? classifyItausaFootnote(notesText[0]) : null;
      if (!basis || basis.basis !== "other_assets_liabilities") warnings.push("Demais Ativos e Passivos footnote changed");
      components.push({
        name: label.text, kind: "other_assets_liabilities", ticker: null, listed: false,
        ownershipPct: null, ownershipReferenceDate: null,
        value: value * MILLION, valueBasis: "other_assets_liabilities", valueReferenceDate: basis?.referenceDate ?? null,
        pricePerShare: null, sharesHeld: null, investeeMarketValue: null, investeeTotalShares: null, parts: null,
        footnote: notesText[0] ?? null, source,
      });
      continue;
    }

    const pct = parseBrPercent(pctCell.text);
    if (pct === null) return { ok: false, error: `ownership unreadable for "${label.text}"` };
    const price = parseBrNumber(priceCell.text);
    const shares = parseBrNumber(sharesCell.text);
    const mv = parseBrNumber(mvCell.text);

    if (price !== null && shares !== null && mv !== null && notesText.length === 0) {
      const ticker = tickerFor(label.text, priceNote);
      if (!ticker) warnings.push(`no ticker for listed component "${label.text}" in footnote (A)`);
      checks.push(check(`${label.text}: market value = price × shares`, mv, price * shares, productTolerance(price, 0.005, shares, 0.5, 0.5)));
      checks.push(check(`${label.text}: stake = market value × ownership`, value, mv * pct, productTolerance(mv, 0.5, pct, 0.0005, 0.5)));
      components.push({
        name: label.text, kind: "investment", ticker, listed: true,
        ownershipPct: pct, ownershipReferenceDate: ownershipDate,
        value: value * MILLION, valueBasis: "market_price", valueReferenceDate: priceDate,
        pricePerShare: price, sharesHeld: null, investeeMarketValue: mv * MILLION, investeeTotalShares: shares * MILLION,
        parts: null, footnote: null, source,
      });
      continue;
    }
    if ([priceCell, sharesCell, mvCell].some(c => normalize(c.text) !== "n/a")) {
      return { ok: false, error: `"${label.text}" has a partial market-price row` };
    }
    const basis = notesText.length ? classifyItausaFootnote(notesText[0]) : { basis: "unclassified" as const, referenceDate: null, parts: null };
    if (basis.basis === "unclassified") warnings.push(`"${label.text}": valuation basis not recognized — stored as unclassified`);
    if (basis.parts) {
      const sum = basis.parts.reduce((s, p) => s + p.value, 0) / MILLION;
      checks.push(check(`${label.text}: mixed-basis parts sum to value`, value, sum, 1));
    }
    components.push({
      name: label.text, kind: "investment", ticker: null, listed: false,
      ownershipPct: pct, ownershipReferenceDate: ownershipDate,
      value: value * MILLION, valueBasis: basis.basis, valueReferenceDate: basis.referenceDate,
      pricePerShare: null, sharesHeld: null, investeeMarketValue: null, investeeTotalShares: null,
      parts: basis.parts, footnote: notesText[0] ?? null, source,
    });
  }

  if (total === null) return { ok: false, error: "portfolio total row missing" };
  if (!market) return { ok: false, error: "Itaúsa market value row missing" };
  if (discountText === null) return { ok: false, error: "discount row missing" };
  if (!market.ticker) return { ok: false, error: "most liquid Itaúsa class not named in footnote (A)" };
  if (!components.some(c => c.kind === "investment")) return { ok: false, error: "no portfolio components" };
  const discount = parseBrPercent(discountText);
  if (discount === null) return { ok: false, error: `discount unreadable: "${discountText}"` };

  const sum = components.reduce((s, c) => s + c.value, 0) / MILLION;
  checks.push(check("sum of parts = Σ components", total, sum, 0.5 * components.length));
  checks.push(check("discount = market value / portfolio value − 1", discount, market.value / total - 1, 0.0005));

  const names = components.filter(c => c.kind === "investment").map(c => c.name);
  const added = names.filter(n => !(EXPECTED_ITAUSA_COMPONENTS as readonly string[]).includes(n));
  const removed = EXPECTED_ITAUSA_COMPONENTS.filter(n => !names.includes(n));
  if (added.length) warnings.push(`portfolio composition changed — new: ${added.join(", ")}`);
  if (removed.length) warnings.push(`portfolio composition changed — missing: ${removed.join(", ")}`);

  const modified = /"dateModified":"(\d{4}-\d{2}-\d{2})T/.exec(html)?.[1] ?? null;
  if (!modified) warnings.push("page dateModified not found — publication date unknown");

  const failed = checks.filter(c => !c.passed);
  const portfolio: HoldingPortfolio = {
    source: {
      kind: "itausa_portfolio_page",
      url,
      title: "Itaúsa — Valor do Portfólio e Desconto",
      publishedUnit: "BRL_millions",
      publicationDateSource: "schema.org WebPage dateModified of the official page",
    },
    portfolioReferenceDate: priceDate,
    portfolioPublicationDate: modified,
    components,
    publishedNetCash: null,
    officialPortfolioValue: total * MILLION,
    officialMarketValue: {
      value: market.value * MILLION,
      method: "most_liquid_class_price_times_total_ex_treasury_shares",
      priceReferenceDate: priceDate,
      classes: [{ ticker: market.ticker, price: market.price, shares: market.shares * MILLION, sharesScope: "all_classes_ex_treasury", value: null }],
    },
    officialDiscount: {
      value: discount,
      published: discountText,
      formula: "officialMarketValue / officialPortfolioValue - 1",
      signConvention: "published_signed",
    },
    standardizedClassWeightedMarketCap: null,
    standardizedClassWeightedMarketCapNote: "Not computed: the official publication prices only the most liquid class (ITSA4); no same-date ITSA3 price is published.",
    validation: { status: failed.length ? "failed" : "passed", checks },
    diagnostics: [
      "Values mix bases as published by Itaúsa (market price, capital-increase price, book value, booked fair value); they are not homogeneous.",
      "Itaúsa's market value prices every share (ON and PN) at the most liquid class (ITSA4) — the issuer's own method.",
    ],
  };
  if (failed.length) return { ok: false, error: `arithmetic check failed: ${failed.map(f => f.name).join("; ")}` };
  return { ok: true, portfolio, warnings };
}
