# Holding model

Covers the two pure listed holdings in the curated universe:

| Issuer | CVM | CNPJ | Share classes | Canonical cache |
|---|---|---|---|---|
| Itaúsa S.A. | 7617 | 61.532.644/0001-15 | ITSA3 (ON), ITSA4 (PN) | `src/data/holding-cache/ITSA4.json` |
| Bradespar S.A. | 18724 | 03.847.461/0001-92 | BRAP3 (ON), BRAP4 (PN) | `src/data/holding-cache/BRAP4.json` |

Identities were verified on 2026-11-03 against the CVM registry
(`cad_cia_aberta.csv`), CVM FCA 2026 `valor_mobiliario` and B3 GetDetail.
BRAP3 was missing from `B3_UNIVERSE` and was added (same issuer as BRAP4).
CSAN3 and GOAU4 are **not** in this model: they consolidate operating
businesses.

Phase 1 built the validated caches; Phase 2 made the model a production route
(see "Product integration" below). All four share classes route to the
`holding` model and are `analysis_ready`.

## Why the industrial model does not apply

A holding's parent-only income statement has no operating revenue: its result
is equity-method income (Itaúsa 1S26 R$10.1bn against R$89mn of G&A;
Bradespar R$805mn against R$20mn), and its cash comes from dividends and
interest on capital received from investees. Revenue growth, margins, EV/EBIT
and capex ratios are undefined or meaningless. Itaúsa's *consolidated*
statements are worse: they consolidate an operating subsidiary (revenue,
inventories, R$10.6bn of debt and R$4.8bn of minority interests) that is not
the holding.

## Statement basis: parent-only (individual)

All holding figures come from the CVM `_ind` files (BPA, BPP, DRE, DFC_MI/MD)
of the DFP and ITR, read by `holdings/holding-cvm-rows.ts` — a separate reader
from the industrial `cvm/dfp-parser.ts`, which is unchanged. Rows whose
`GRUPO_DFP` is not "DF Individual", or whose CNPJ is not the issuer's, are
rejected. The highest filed version per period is used (Itaúsa re-filed 2T26
as v2) and, for flow statements, the cumulative row starting on 1 January.

| Field | CVM account | Notes |
|---|---|---|
| Cash | 1.01.01 Caixa e Equivalentes de Caixa | the only account counted as cash |
| Short-term investments | 1.01.02 Aplicações Financeiras | classified, **never** cash (see below) |
| Equity stakes | 1.02.02 Investimentos | Bradespar files 1.02.02.01 = 0, so the parent account is used |
| Gross debt | 2.01.04 + 2.02.01 Empréstimos e Financiamentos | includes debentures; Bradespar = 0 |
| Equity | 2.03 | |
| G&A | 3.04.02 | CVM sign (negative) |
| Equity-method income | 3.04.06 | |
| Financial expenses | 3.06.02 | not only interest |
| Net income | 3.11 | |
| Dividends/JCP received | Itaúsa 6.02.07, Bradespar 6.01.02.03 | company-defined, description-verified |
| Interest paid | Itaúsa 6.01.03.02; Bradespar none | |
| Shares by class, treasury | `composicao_capital` | thousands of shares in the CVM file |

Fixed accounts are checked against their standard description. The
company-defined cash-flow lines use `holding-identities.ts` mappings and fail
closed — the value stays `null` with an issue — when the description at the
code changes, the description moves to another code, or the code has
conflicting rows. Bradespar files both "Juros sobre o Capital Próprio e
Dividendos Recebidos" and (ITR Q1) "Juros sobre Capital Próprio e Dividendos
Recebidos"; both are verified spellings.

**Itaúsa 1.01.02.** At 2026-06-30 the R$1.505bn balance is the NTS stake at
booked fair value — the same amount as the NTS line of the official portfolio.
It is classified `portfolio_investment` and is never added to cash or
subtracted in net debt. The precompute flags the classification for
re-verification if the amount stops matching a booked-fair-value portfolio
line at the same balance date.

**Statement net debt** (`statements[].netDebt`) = `grossDebt` − `cash`
(1.01.01) at the statement date. Investments are never netted.

**Two different net-cash concepts.** The statement position
(`statements[].cash`, `.grossDebt`, `.netDebt`; Bradespar at 2026-06-30:
cash R$254.451mn, gross debt 0, net debt −R$254.451mn) is never replaced by
the issuer-published net cash of a portfolio publication
(`portfolio.publishedNetCash`; Bradespar bulletin at 2026-10-30:
R$511.033mn). The published figure, with its own reference date, is only an
input to the official NAV (Vale stake + published net cash = official NAV);
the statement net debt is never substituted into that NAV. Itaúsa's page has
no net-cash line (`publishedNetCash: null`).

**TTM** flows (dividends received, G&A, equity-method income, financial
expenses, net income) are built from cumulative filings:
`TTM(Qn) = YTD(Qn) + FY(previous year) − YTD(Qn of the previous year)`; at Q4
the fiscal year itself. Any missing or non-comparable input gives `null`,
never zero. Interim comparatives come from each period's own ÚLTIMO filing.

## Official portfolio sources

### Itaúsa — "Valor do Portfólio e Desconto"

<https://ri.itausa.com.br/informacoes-financeiras/valor-do-portfolio-e-desconto/>,
a server-rendered HTML table (R$ millions) with footnotes (A)–(G). Parsed by
`holdings/itausa-portfolio.ts`. The snapshot is stored exactly as published.

| Component | Basis | Source of the basis |
|---|---|---|
| Itaú Unibanco, Dexco, Alpargatas, Motiva | `market_price` | (A) closing prices of the most liquid classes (ITUB4, DXCO3, ALPA4, MOTV3) |
| Aegea | `mixed_transaction_and_book` | (D) ON shares at the 2026 capital-increase price + PN shares at book value; both parts stored |
| Copa Energia | `book_value` | (E) investment as booked at the balance-sheet date |
| NTS | `booked_fair_value` | (F) fair value as booked at the balance-sheet date |
| Demais Ativos e Passivos | `other_assets_liabilities` | (G) parent-only balance sheet — **taken as published, not rebuilt from CVM** |

The bases are not homogeneous and are never presented as if they were
(Itaúsa itself notes Copa Energia at book value understates it). Ownership is
the direct + indirect stake from Note 1 of the statements (footnote C). A new
component is kept with its footnote basis (or `unclassified`) and a warning;
nothing is silently dropped.

Publication date: the page's schema.org `dateModified`. Reference date: the
price date in footnote (A).

### Bradespar — Boletim Quinzenal

Discovery: the official AEM listing
`…/graphql/execute.json/banco-bradesco/bradespar-get-all-files;path=…/pt/boletim-quinzenal`
(JSON). Data: the latest bulletin, a one-page PDF. Its embedded text layer is
extracted at precompute time with **unpdf 1.7.0** (a dependency-free
serverless build of Mozilla pdf.js; devDependency) — no OCR, no rendering, no
browser, no system binary, Node 20 compatible. Parsed by
`holdings/bradespar-bulletin.ts` with label-anchored rules: every expected
line must appear exactly once, and the footnotes stating the discount formula
and the share-count basis must be present verbatim.

Extracted: bulletin date, closing-price date, net-cash date, Vale quantity,
price and published ownership, Vale stake value (A), net cash (B), NAV (C),
market value (D), BRAP3/BRAP4 prices and share counts, (C) − (D), discount.

Validated (R$ thousands, tolerance R$1 thousand per rounded figure): Vale
quantity × price = (A); (A) + (B) = (C); Σ class price × class shares = (D);
(C) − (D); |(D)/(C) − 1| = published discount within half a unit of its last
digit. Any failure rejects the snapshot.

### The 3.84% caveat

Bradespar publishes Vale ownership as 3.84% with footnote (3) "Não considera
ações em tesouraria". On CVM data (Vale ITR: 4,255,762 thousand shares issued,
183,396 thousand in treasury) 163,354,595 shares are ≈3.84% only **with**
treasury shares in the denominator (≈4.01% ex-treasury). The published figure
is stored unchanged (`ownershipPct`, company-published) with this caveat in
the snapshot diagnostics. It is never used in a calculation: the stake value
comes from the published share quantity.

## Official vs standardized market value

| | Itaúsa | Bradespar |
|---|---|---|
| `officialMarketValue.method` | `most_liquid_class_price_times_total_ex_treasury_shares` (ITSA4 price × all shares ex-treasury) | `class_price_times_class_shares_sum` |
| `officialDiscount` | market value / portfolio value − 1, published signed ("-18,2%") | same formula, published as a positive magnitude ("34,1%") — stored as −0.341 |
| `standardizedClassWeightedMarketCap` | `null` — no same-date ITSA3 price in the official source | Σ(BRAP3, BRAP4 price × shares) from the same bulletin |

The standardized figure is diagnostic and never overwrites or recomputes the
official one. brapi `marketCap` is not used. No current quote is fetched to
fill a historical snapshot. Market prices always stay ticker-specific.

## Reference dates

The cache keeps separately: statement reference date and filing date (and
version), portfolio reference (price) date and publication date, each
component's value date (and each mixed part's), ownership date, share-count
date and the price date of each class in the official market value. Indicators
list the dates of all their inputs; statement and portfolio dates differ and
are never presented as simultaneous.

## Freshness

A portfolio is **fresh** when its reference period is at most one fiscal
quarter older than the latest statement period (`quarterLag ≤ 1`), comparing
source periods only — never the current date. A stale snapshot stays in the
cache and makes the issuer `analysis_limited`.

## Cache design and failure semantics

One cache per issuer under the canonical ticker (PN, most liquid). It contains
issuer-wide fundamentals and both share classes. `holding-identities.ts` maps
ITSA3 → ITSA4 and BRAP3 → BRAP4 for **fundamentals only**; this is not a
generic fundamentals alias and implies no market-price aliasing. Itaúsa is
never aliased to Itaú Unibanco.

Schema (`holdings/holding-types.ts`): `issuer`, `shareClasses[]`,
`statements[]`, `latestStatement`, `portfolio` (components with individual
bases, official totals, validation checks, diagnostics), `portfolioFreshness`,
`indicators`, `referenceDates`, `provenance`, `enrichment`, `warnings`,
`updatedAt`. Values in BRL; deterministic except `updatedAt`.

`npm run holding:precompute` (network at precompute time only;
`HOLDING_PRECOMPUTE_TICKERS=BRAP3` targets one issuer), per issuer:

| CVM | Portfolio source | Result |
|---|---|---|
| ok | ok | both advance |
| ok | fails / older snapshot | statements advance; previous validated snapshot kept (`preserved`) |
| fails | ok | previous statement history kept (`preserved`); new snapshot used |
| fails | fails | nothing written |
| any, no previous cache | — | written only if CVM succeeded; portfolio stays `null` (never invented) |

Statement history is merged by period, so a refresh never shortens it. The
refresh guard (`cache-refresh/refresh-guard.ts`) accepts
`src/data/holding-cache/` and rejects an identity change, a latest statement
period or portfolio date moving backwards, a validated portfolio disappearing
and components becoming empty. The scheduled cache refresh runs
`npm run holding:precompute` in the existing `sector-models` scope (after the
bank, FII and insurance caches); `npm run validate` (which includes
`holding:audit`) is the barrier, and only `src/data/holding-cache/*.json` can be
committed by the bot.

`npm run holding:audit` reports, per issuer, identity, share classes, latest
statement, portfolio source/dates/total, official market value and discount,
concentration, cash, gross and net debt, TTM dividends, freshness, validation
status and warnings, and checks the ON → PN cache resolution.

## Descriptive only

The model stores what the issuers publish and what their parent-only filings
show. It does not produce fair value, intrinsic value, target price,
upside/downside, buy/sell/hold, cheap/expensive or any recommendation. The
official discount is an issuer-provided structural metric.

Indicators — core: official portfolio value, listed and unlisted/report-based
investment value, largest investee concentration (share of positive investee
value: largest positive investee / Σ positive investee values — net cash and
"Demais Ativos e Passivos" are excluded, and the denominator is not the net
sum of the parts; Itaúsa 183,118 / 201,191 = 91.02%), statement cash, gross
and net debt, TTM dividends received, TTM G&A, TTM equity-method income, net debt /
official portfolio value, official market value, official discount.
Secondary: equity, TTM net income, TTM financial expenses, dividends /
financial expenses (not meaningful without borrowings), gross debt /
dividends, G&A / dividends, standardized class-weighted market cap. No revenue
growth/CAGR, EBIT/FCF/CFO margins, EV multiples, capex ratios or headline P/L.

## Product integration (Phase 2)

**Routing.** `classifyAsset` returns the asset type `holding` for every share
class of a verified issuer (`HOLDING_SHARE_CLASS_TICKERS`, derived from
`VERIFIED_HOLDING_IDENTITIES` — never from sector names such as "Holding
Financeira"/"Holding Industrial", the ticker suffix or the industrial CVM map).
`resolveModelRoute` returns `holding` when the issuer is registered in
`holding-coverage.ts`, else `sector_specific_pending`; a holding never routes
to the industrial, bank or quote-only models. CSAN3 and GOAU4 are unchanged
(industrial, flagged as holding review candidates).

**Coverage.** ITSA3, ITSA4, BRAP3 and BRAP4 are `sector_specific_model_required`
in `B3_UNIVERSE` (like the other sector-model assets) with the reason code
`HOLDING_MODEL_REQUIRED`; the coverage page shows them with the "Modelo de
Holding" badge and links them to the dashboard.

**Readiness** (`holdings/holding-readiness.ts`, used by
`coverage:audit:readiness`, `report:audit` and the API):

| Cache state | Readiness |
|---|---|
| verified identity, latest parent-only statement with cash, gross debt, equity, stakes, equity-method income, net income and dividends received, share-class counts, validated and fresh portfolio, nothing preserved | `analysis_ready` |
| usable, but portfolio stale/preserved/missing/unvalidated, statements preserved, a core account or share count missing | `analysis_limited` |
| missing/unreadable, wrong schema, identity or statement basis, or neither statement nor portfolio | `cache_pending` |

The Phase 1 `model_pending` decisions for ITSA3, ITSA4, BRAP3 and BRAP4 were
removed; there is no ticker-specific readiness exception.

**API.** `GET /api/holdings/analysis/[ticker]` (`holdings/holding-analysis.ts`)
reads the committed cache only — no CVM, IR or PDF access and no `unpdf` in
the request path. It returns `requestedTicker` and `canonicalTicker`
separately, the issuer, the requested and all share classes, the latest
statement (without raw accounts), the portfolio (investees, the "other assets
and liabilities" reconciliation lines, `publishedNetCash`, positive-investee
denominator, official totals, validation summary), indicators, reference
dates, freshness, enrichment, `analysisStatus` (`ready`/`limited`), Portuguese
user-facing `notices` and source names. Unsupported tickers return 404 with
`available: false`; a missing or unusable cache returns `available: false`
(`cache_unavailable`). Quotes are not part of the payload: the dashboard and
the report fetch the requested ticker's own quote.

**UI.** `HoldingAnalysisPanel` (dashboard and `/relatorio/[ticker]`) shows, in
order: overview (8 headline figures), portfolio composition (composition bar
over positive investee value, table/stacked cards with value basis and dates,
"Demais Ativos e Passivos" as a reconciliation line, Bradespar's Vale stake
detail with the 3.84% footnote, official market value by class and the
official discount), parent-company financial position (statement date; the
Bradespar bulletin net cash shown apart with its own date), cash generation
(TTM), share classes (requested class highlighted) and dates/sources/notes.
Nulls render as "N/D"; debt ratios of a holding without borrowings render
"Não aplicável".
