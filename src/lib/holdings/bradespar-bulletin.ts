// Bradespar official portfolio: the fortnightly "Boletim Quinzenal" (BQ).
//
// Discovery: Bradespar's AEM persisted query lists every bulletin (JSON).
// Data: each bulletin is a one-page PDF; its embedded text (extracted by
// bradespar-pdf-text.ts at precompute time) is parsed here with strict,
// label-anchored line rules and validated arithmetically. The published Vale
// ownership percentage is stored as published and never used to value the
// stake — the published share quantity is.
//
// Precompute time only. No @/ imports — also used by tsx scripts.

import type { HoldingPortfolio, HoldingPortfolioComponent, ValidationCheck } from "./holding-types";
import {
  check,
  decimalsOf,
  parseBrDate,
  parseBrNumber,
  parseBrPercent,
  type PortfolioParseResult,
} from "./holding-portfolio-validation";

export const BRADESPAR_AEM_HOST = "https://publish-p128342-e1259725.adobeaemcloud.com";
export const BRADESPAR_BQ_LISTING_URL =
  `${BRADESPAR_AEM_HOST}/graphql/execute.json/banco-bradesco/bradespar-get-all-files;path=/content/dam/banco-bradesco/bradespar/conteudos/arquivos/pt/boletim-quinzenal`;
const BQ_FILE_PREFIX = "/content/dam/banco-bradesco/bradespar/staticfiles/assets/pdf/boletim-quinzenal/";

const THOUSAND = 1_000;

/** Bulletin investee labels → B3 ticker of the class held. */
const INVESTEE_TICKERS: Readonly<Record<string, string>> = { "VALE ON": "VALE3" };

/** Rounding allowance for figures published in whole R$ thousands. */
export const BRADESPAR_TOLERANCE_THOUSANDS = 1;

// ─── Discovery ────────────────────────────────────────────────────────────────

export interface BulletinListing {
  title: string;
  fileDate: string;
  pdfPath: string;
  pdfUrl: string;
}

/** Latest bulletin in the AEM listing. Throws when the payload changes shape. */
export function latestBulletinFromListing(json: unknown): BulletinListing {
  const items = (json as { data?: { bradesparArquivoList?: { items?: unknown } } })?.data?.bradesparArquivoList?.items;
  if (!Array.isArray(items)) throw new Error("Bradespar listing: unexpected payload");
  const bulletins: BulletinListing[] = [];
  for (const it of items as Record<string, unknown>[]) {
    const title = typeof it.title === "string" ? it.title : "";
    const fileDate = typeof it.file_date === "string" ? it.file_date : "";
    const path = (it.upload_file as { _path?: unknown } | null)?._path;
    if (!/^BQ - \d{2}\/\d{2}\/\d{4}$/.test(title) || !/^\d{4}-\d{2}-\d{2}$/.test(fileDate)) continue;
    if (typeof path !== "string" || !path.startsWith(BQ_FILE_PREFIX) || !path.toLowerCase().endsWith(".pdf")) continue;
    if (parseBrDate(title.slice(5)) !== fileDate) continue;
    bulletins.push({ title, fileDate, pdfPath: path, pdfUrl: `${BRADESPAR_AEM_HOST}${encodeURI(path)}` });
  }
  if (bulletins.length === 0) throw new Error("Bradespar listing: no bulletin entries");
  bulletins.sort((a, b) => b.fileDate.localeCompare(a.fileDate) || a.pdfPath.localeCompare(b.pdfPath));
  return bulletins[0];
}

// ─── Text parsing ─────────────────────────────────────────────────────────────

const NUM = "\\(?-?[\\d.]+(?:,\\d+)?\\)?";

function singleLine(lines: string[], re: RegExp, label: string): RegExpExecArray {
  const hits = lines.map(l => re.exec(l)).filter((m): m is RegExpExecArray => m !== null);
  if (hits.length !== 1) throw new Error(`${label}: expected 1 line, found ${hits.length}`);
  return hits[0];
}

function num(text: string, label: string): number {
  const n = parseBrNumber(text);
  if (n === null) throw new Error(`${label}: unreadable number "${text}"`);
  return n;
}

export interface ParsedBulletin {
  bulletinDate: string;
  priceReferenceDate: string;
  netCashReferenceDate: string;
  holdings: { label: string; price: number; priceText: string; shares: number; ownershipPctPublished: number; ownershipText: string; valueThousands: number }[];
  totalAssetsThousands: number;
  netCashThousands: number;
  navThousands: number;
  marketValueThousands: number;
  classes: { ticker: "BRAP3" | "BRAP4"; price: number; priceText: string; shares: number; valueThousands: number }[];
  differenceThousands: number;
  discountText: string;
  discountMagnitude: number;
}

/** Strict field extraction from the bulletin text. Throws on any unexpected layout. */
export function parseBulletinText(text: string): ParsedBulletin {
  const lines = text.split(/\r?\n/).map(l => l.replace(/\s+/g, " ").trim()).filter(Boolean);

  singleLine(lines, /^BOLETIM DE RELAÇÕES COM INVESTIDORES$/, "bulletin header");
  const bulletinDate = parseBrDate(lines[0]);
  if (!bulletinDate) throw new Error(`bulletin date: unexpected first line "${lines[0]}"`);
  const priceDate = parseBrDate(singleLine(lines, /\(preços de fechamento em (\d{2}\/\d{2}\/\d{4})\)/, "price date")[1]);
  const cashDate = parseBrDate(singleLine(lines, /^\(1\) Caixa Líquido em (\d{2}\/\d{2}\/\d{4})\.$/, "net cash date")[1]);
  if (!priceDate || !cashDate) throw new Error("reference dates unreadable");
  singleLine(lines, /^\(2\) \(\(Valor de mercado da Bradespar\)\/\(Valor dos Ativos \+ Caixa Líquido\)\) - 1$/, "discount formula");
  singleLine(lines, /^\(3\) Não considera ações em tesouraria$/, "share-count footnote");

  // Investee rows sit between the column header and "Valor Total dos Ativos".
  const start = lines.findIndex(l => l.startsWith("(EURO mil)"));
  const end = lines.findIndex(l => l.startsWith("Valor Total dos Ativos da Bradespar"));
  if (start < 0 || end < 0 || end <= start + 1) throw new Error("investee table not found");
  const holdingRe = new RegExp(`^(.+?) (${NUM}) ([\\d.]+) (\\d+,\\d+%) (${NUM}) (${NUM}) (${NUM})$`);
  const holdings = lines.slice(start + 1, end).map(l => {
    const m = holdingRe.exec(l);
    if (!m) throw new Error(`unexpected investee row "${l}"`);
    const pct = parseBrPercent(m[4]);
    if (pct === null) throw new Error(`ownership unreadable "${m[4]}"`);
    return { label: m[1], price: num(m[2], "price"), priceText: m[2], shares: num(m[3], "shares"),
      ownershipPctPublished: pct, ownershipText: m[4], valueThousands: num(m[5], "value") };
  });

  const amount = (re: RegExp, label: string) => num(singleLine(lines, re, label)[1], label);
  const totalAssets = amount(new RegExp(`^Valor Total dos Ativos da Bradespar \\( A \\) (${NUM}) ${NUM} ${NUM}$`), "total assets (A)");
  const netCash = amount(new RegExp(`^Caixa Líquido da Bradespar \\( B \\) \\(1\\) (${NUM}) ${NUM} ${NUM}$`), "net cash (B)");
  const nav = amount(new RegExp(`^Valor Líquido dos Ativos da Bradespar \\( C \\) = \\( A \\) \\+ \\( B \\) (${NUM}) ${NUM} ${NUM}$`), "NAV (C)");
  const marketValue = amount(new RegExp(`^Valor de Mercado da Bradespar \\( D \\) (${NUM}) ${NUM} ${NUM}$`), "market value (D)");
  const difference = amount(new RegExp(`^Diferença entre o Valor Líquido dos Ativos e Valor de Mercado Bradespar \\( C \\) - \\( D \\) (${NUM}) ${NUM} ${NUM}$`), "difference (C − D)");

  const classes = ([["BRAP3", "Ordinárias"], ["BRAP4", "Preferenciais"]] as const).map(([ticker, kind]) => {
    const m = singleLine(lines, new RegExp(`^Ações ${kind} \\(${ticker}\\) (${NUM}) ([\\d.]+) (${NUM}) ${NUM} ${NUM}$`), ticker);
    return { ticker, price: num(m[1], `${ticker} price`), priceText: m[1], shares: num(m[2], `${ticker} shares`), valueThousands: num(m[3], `${ticker} value`) };
  });

  const discountText = singleLine(lines, /^DESCONTO \(2\) (-?\d+,\d+%)$/, "discount")[1];
  const discountMagnitude = parseBrPercent(discountText);
  if (discountMagnitude === null) throw new Error("discount unreadable");

  return {
    bulletinDate, priceReferenceDate: priceDate, netCashReferenceDate: cashDate, holdings,
    totalAssetsThousands: totalAssets, netCashThousands: netCash, navThousands: nav,
    marketValueThousands: marketValue, classes, differenceThousands: difference,
    discountText, discountMagnitude,
  };
}

/** Arithmetic checks in R$ thousands (prices are exact closes; values are rounded to R$ 1 thousand). */
export function validateBulletin(b: ParsedBulletin): ValidationCheck[] {
  const t = BRADESPAR_TOLERANCE_THOUSANDS;
  const checks: ValidationCheck[] = [];
  for (const h of b.holdings) {
    checks.push(check(`${h.label}: value = shares × price`, h.valueThousands, h.shares * h.price / THOUSAND, t));
  }
  checks.push(check("total assets (A) = Σ investees", b.totalAssetsThousands, b.holdings.reduce((s, h) => s + h.valueThousands, 0), t * b.holdings.length));
  checks.push(check("NAV (C) = (A) + net cash (B)", b.navThousands, b.totalAssetsThousands + b.netCashThousands, t));
  for (const c of b.classes) {
    checks.push(check(`${c.ticker}: value = shares × price`, c.valueThousands, c.shares * c.price / THOUSAND, t));
  }
  checks.push(check("market value (D) = Σ class price × class shares", b.marketValueThousands,
    b.classes.reduce((s, c) => s + c.shares * c.price, 0) / THOUSAND, t));
  checks.push(check("difference = (C) − (D)", b.differenceThousands, b.navThousands - b.marketValueThousands, t));
  // Published as a positive magnitude labelled DESCONTO; formula (2) is D / C − 1.
  const decimals = decimalsOf(b.discountText) + 2;
  checks.push(check("discount = (D) / (C) − 1 (published magnitude)", b.discountMagnitude,
    Math.abs(b.marketValueThousands / b.navThousands - 1), 0.5 * 10 ** -decimals));
  return checks;
}

const OWNERSHIP_CAVEAT =
  "Bradespar publishes Vale ownership as 3.84% with footnote (3) 'Não considera ações em tesouraria'. " +
  "On CVM share data, 163,354,595 Vale shares are ≈3.84% only with Vale's treasury shares in the denominator " +
  "(≈4.01% ex-treasury). The published percentage is stored unchanged and is not used for any calculation; " +
  "the stake is valued from the published share quantity.";

export function bulletinToPortfolio(
  b: ParsedBulletin,
  listing: BulletinListing,
): PortfolioParseResult {
  const warnings: string[] = [];
  if (b.bulletinDate !== listing.fileDate) {
    return { ok: false, error: `bulletin date ${b.bulletinDate} does not match listing ${listing.fileDate}` };
  }
  const checks = validateBulletin(b);
  const failed = checks.filter(c => !c.passed);
  if (failed.length) return { ok: false, error: `arithmetic check failed: ${failed.map(f => f.name).join("; ")}` };

  const labels = b.holdings.map(h => h.label);
  if (labels.length !== 1 || labels[0] !== "VALE ON") warnings.push(`portfolio composition changed: ${labels.join(", ")}`);

  const source = listing.pdfUrl;
  const components: HoldingPortfolioComponent[] = b.holdings.map(h => {
    const ticker = INVESTEE_TICKERS[h.label] ?? null;
    if (!ticker) warnings.push(`no ticker mapping for investee "${h.label}"`);
    return {
      name: h.label === "VALE ON" ? "Vale" : h.label,
      kind: "investment",
      ticker,
      listed: true,
      ownershipPct: h.ownershipPctPublished,
      ownershipReferenceDate: null,
      value: h.valueThousands * THOUSAND,
      valueBasis: "market_price",
      valueReferenceDate: b.priceReferenceDate,
      pricePerShare: h.price,
      sharesHeld: h.shares,
      investeeMarketValue: null,
      investeeTotalShares: null,
      parts: null,
      footnote: `% do Capital Total (3): ${h.ownershipText} as published (company-published; not used in calculations)`,
      source,
    };
  });
  components.push({
    name: "Caixa Líquido da Bradespar",
    kind: "net_cash",
    ticker: null,
    listed: false,
    ownershipPct: null,
    ownershipReferenceDate: null,
    value: b.netCashThousands * THOUSAND,
    valueBasis: "net_cash",
    valueReferenceDate: b.netCashReferenceDate,
    pricePerShare: null, sharesHeld: null, investeeMarketValue: null, investeeTotalShares: null, parts: null,
    footnote: `(1) Caixa Líquido em ${b.netCashReferenceDate.split("-").reverse().join("/")}.`,
    source,
  });

  const classes = b.classes.map(c => ({
    ticker: c.ticker, price: c.price, shares: c.shares, sharesScope: "class_ex_treasury" as const, value: c.valueThousands * THOUSAND,
  }));
  const standardized = b.classes.reduce((s, c) => s + c.shares * c.price, 0);

  const portfolio: HoldingPortfolio = {
    source: {
      kind: "bradespar_boletim_quinzenal",
      url: source,
      title: listing.title,
      publishedUnit: "BRL_thousands",
      publicationDateSource: "AEM listing file_date (matches the bulletin's own date line)",
    },
    portfolioReferenceDate: b.priceReferenceDate,
    portfolioPublicationDate: b.bulletinDate,
    components,
    publishedNetCash: {
      value: b.netCashThousands * THOUSAND,
      referenceDate: b.netCashReferenceDate,
      source,
      usage: "input_to_official_portfolio_value",
    },
    officialPortfolioValue: b.navThousands * THOUSAND,
    officialMarketValue: {
      value: b.marketValueThousands * THOUSAND,
      method: "class_price_times_class_shares_sum",
      priceReferenceDate: b.priceReferenceDate,
      classes,
    },
    officialDiscount: {
      value: -b.discountMagnitude,
      published: b.discountText,
      formula: "officialMarketValue / officialPortfolioValue - 1",
      signConvention: "published_as_positive_discount_magnitude",
    },
    standardizedClassWeightedMarketCap: Math.round(standardized * 100) / 100,
    standardizedClassWeightedMarketCapNote: "Σ(BRAP3, BRAP4 closing price × class shares ex-treasury) from the same bulletin and date.",
    validation: { status: "passed", checks },
    diagnostics: b.holdings.some(h => h.label === "VALE ON") ? [OWNERSHIP_CAVEAT] : [],
  };
  return { ok: true, portfolio, warnings };
}
