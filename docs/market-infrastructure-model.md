# Market-infrastructure model (B3SA3) — Phase 1

Phase 1 covers data acquisition, normalization, cache, indicators and audit.
It produces one committed cache, `src/data/market-infrastructure-cache/B3SA3.json`.

Nothing consumes the cache yet. B3SA3 keeps routing to `quote_only`, with readiness
`model_pending`, until Phase 2 integrates routing and UI.

The model is **descriptive**. It produces no fair value, target price,
upside/downside, buy/sell/hold or cheap/expensive language.

## Why B3 needs its own model

B3 is a financial-market infrastructure. It runs exchanges, CCPs (Câmara B3 and
the FX clearinghouse), the central depository, OTC registries, the vehicle-lien
registry (SNG) and data businesses, and it owns a bank (Banco B3).

The industrial template misreads such a company in four places:

- **3.02 is not a cost line.** "Custo dos Bens e/ou Serviços Vendidos" holds only
  revenue taxes (PIS/Cofins, ISS). So 3.03 "Resultado Bruto" is net revenue, and a
  gross margin does not exist.
- **The balance sheet carries participants' resources.** Cash collateral and
  proceeds on securities in custody appear as liabilities, backed by assets inside
  cash and financial investments.
- **CVM operating cash flow mixes in non-operating flows.** It carries
  financial-investment and collateral flows: ±R$6bn and ±R$3bn a year.
- **Revenue is driven by volume, value and stock.** It depends on contracts traded,
  traded value, issuance and outstanding stock. B3 publishes its own unit economics
  (RPC and fee margins in bps).

## Sources

All sources are fetched at precompute time only.

| Source | Use |
|---|---|
| CVM `cad_cia_aberta.csv` | Identity check: CD_CVM 21610, CNPJ 09.346.601/0001-25, ATIVO. |
| CVM DFP/ITR `_con` files (BPA, BPP, DRE, DFC_MI), filing index | Consolidated statements from FY2019. |
| CVM `composicao_capital` | Share counts. B3 files them in **units**, not thousands. |
| B3 RI file manager (MZiQ): category `central_de_resultados_dre`, title "Dados Trimestrais - Nova Segmentação" (XLSX) | Operating KPIs, expense breakdown, official reconciliation figures. |

Run `npm run market-infrastructure:precompute`, then `npm run market-infrastructure:audit`.
The precompute is not part of `.github/workflows/` in Phase 1.

The monthly "Destaques Operacionais" PDF is out of scope.

## Statement basis and history

- **Basis: consolidated.** Parent-only (DF Individual) rows are rejected.
- **Statement history:** FY2019 onward, with every ITR since 2019. This is 30
  statements as of 2T26.
- Each statement keeps:
  - its reference period, fiscal year and quarter;
  - its filing date (DT_RECEB), filing version and CVM document id.
- Only the highest version of each filing is used.

## Account mapping

### Fixed accounts (ST_CONTA_FIXA = S)

Fixed accounts are read by code. Each one must also carry its standard
description, or it is not read.

| Field | Account |
|---|---|
| Gross revenue | 3.01, plus revenue-tax sub-lines filed inside it (see below) |
| Revenue deductions | 3.02 |
| Net revenue | 3.03 |
| Operating expenses | 3.04.02. The check requires 3.04.01 = 0. |
| Impairment / other operating income / other operating expenses / equity method | 3.04.03 / 3.04.04 / 3.04.05 / 3.04.06 |
| EBIT (stored, not a headline) | 3.05 |
| Financial result / pre-tax / income tax | 3.06 / 3.07 / 3.08 |
| Net income attributable to shareholders | 3.11.01 |
| Balance-sheet cash | 1.01.01 |
| Financial investments | 1.01.02 + 1.02.01.01 + 1.02.01.02 + 1.02.01.03 |
| Gross debt | 2.01.04 + 2.02.01 |
| Equity / non-controlling interests | 2.03 / 2.03.09 |
| Operating cash flow (raw provenance only) | 6.01 |
| Cash-flow closing cash | 6.05.02. Used only when 6.05.01 + 6.05 = 6.05.02. |

**Revenue-tax layout.** ITRs from 2019 to 2022 filed PIS/Cofins and ISS *inside* 3.01
(3.01.05–3.01.07), with 3.02 = 0. Gross revenue adds these lines back. The
statement must then satisfy gross revenue + deductions = 3.03. If a non-tax line
appears under 3.02, gross revenue and deductions are null.

### Issuer-specific lines

These are matched by code plus a verified description:

- 2.01.05.02.04 "Garantia Recebidas em Operações" (B3's singular spelling);
- 2.01.05.02.05 "Proventos e Direitos sobre Títulos em Custódia";
- 2.01.05.02.08 and 2.02.02.02.04 "Instrumentos Financeiros Derivativos".

The non-current derivative line is filed only in some periods (2020-03 to 2025-09).
When it is absent, it counts as zero only if 2.02.02.02 "Outros" equals the sum of
the children that were filed.

### Cash-flow lines

Codes drift across years (6.02.02–6.02.06, 6.03.01–6.03.08), so these lines are
matched by verified description among the direct children of their section:

| Line | Section | Verified descriptions |
|---|---|---|
| D&A | 6.01.01 | "Depreciação e Amortização" |
| PP&E capex | 6.02 | "Aquisição de Imobilizado" |
| Software capex | 6.02 | "Aquisição e Desenvolvimento de Softwares" |
| Distributions | 6.03 | "Pagamento de Proventos" and its verified variants |
| Buybacks | 6.03 | "Recompra de Ações" |

Exactly one line must match. With zero matches the field is null ("not filed").
With several matches it is null as ambiguous.

Duplicate rows are **never summed just because their descriptions match**. FY2023
files "Pagamento de Proventos" at both 6.03.07 (−R$41.7mn) and 6.03.08
(−R$1,993.8mn), and 1T19 files two dividend/JCP lines. Summing would require two
things:

- the rows have distinct, validated accounting roles; and
- the hierarchy or source proves they are additive components.

Neither is available, so FY2023 and 1T19 distributions stay null. The current TTM
(2T26, FY2025, 1S25) has a single line in each period and is unaffected.

### Fail-closed rules

Every reader fails closed. A missing row, conflicting duplicates, a relabelled
code, or a verified description that moves to another code all give **null with
an issue**, never zero and never a guess.

## Own vs third-party balances

- **1.01.01 is never "B3 cash".** It is stored as `balanceSheetCashReported`. At
  2026-06-30 it is R$1,163.2mn, of which R$807.9mn is outside the cash-flow
  statement's cash.
- **Cash per cash-flow statement (secondary/provenance only).**
  `cashAndCashEquivalentsPerCashFlow` is the closing cash of the cash-flow
  statement (6.05.02): R$355.3mn at 2026-06-30.
  - It is used only when the cash-flow statement reconciles and the figure does not
    exceed 1.01.01. It is never derived as a residual.
  - It never enters net debt, the managed position, liquidity ratios or leverage.
  - B3's ITR 2T26 note 4a states that this figure is its own cash, excluding
    third-party resources. That reading is validated **only for 2026-06-30**
    (`ownCashInterpretationValidatedFor`) and is not generalised to other periods.
- **Third-party memo.** `thirdPartyBalances` holds collateral received and custody
  payments, separately. They are subtracted in the managed position and never
  enter a corporate liquidity metric. No other third-party balance can be
  identified from structured data, so `otherValidatedThirdPartyBalances` is `[]`.
- **No cash − debt net debt is computed.**

## Managed net financial position ("Posição financeira líquida gerida")

This reproduces B3's capital-management note ("diferença entre os ativos e os
passivos financeiros geridos") from CVM rows:

```
  1.01.01 + 1.01.02 + 1.02.01.01 + 1.02.01.02 + 1.02.01.03     (derivative assets are inside)
− (2.01.05.02.08 + 2.02.02.02.04)                              derivative liabilities
− (2.01.04 + 2.02.01)                                          gross debt
− 2.01.05.02.04                                                collateral received
− 2.01.05.02.05                                                custody payments
```

It reproduces both research anchors to the thousand:

- **+R$1,560,977 thousand** at 2026-06-30;
- **−R$243,139 thousand** at 2025-12-31.

If any component is missing or unverified, the whole measure is null.

**Caveat:** this is not free cash, net cash or "caixa disponível". It may include:

- B3-owned resources earmarked for the clearinghouses and for regulation: the
  contribution to the CCP liquidation fund, dedicated clearinghouse cash, the FX
  clearing fund and "patrimônio especial";
- Banco B3 settlement balances (repos and demand deposits).

Only the PDF notes split these out, so Phase 1 does not subtract them. No "free
cash" metric exists.

## Operating result and EBITDA

These follow B3's published concept, reproduced exactly:

- **Operating result** = net revenue (3.03) + operating expenses (3.04.02, negative).
- **Operating margin** = operating result / net revenue.
  - 2T26 quarter: 64.72%, identical to the workbook.
  - The indicator is TTM: 66.06%.
- **EBITDA** = operating result + D&A (cash-flow add-back).
  - 2T26 quarter: R$1,885,398 thousand, identical to the workbook's "EBITDA".
  - The quarter figure is YTD(6M) − YTD(3M), each from its own filing.
  - TTM: R$7,503.5mn; margin 69.62%.
- **This is B3's reported operating EBITDA concept.** A regression test proves
  that 2T26 operating result + D&A = R$1,885.4mn.
- **EBIT (3.05)** stays stored as accounting EBIT but is not used for EBITDA. It
  includes items outside B3's operating-result line (3.04.03–3.04.06). In 2T26
  these are the R$123.9mn Dimensa disposal gain and equity-method income, so
  3.05 + D&A gives R$2,010.1mn and does not reconcile to B3's EBITDA.
- **Leverage (CORE)** = gross debt / reproducible EBITDA TTM = **1.99x** at 2T26.
  B3's figure of about 2.0x uses its company-adjusted recurring EBITDA, which is
  not used here.

## Revenue segments

**Taxonomy.** The current taxonomy, introduced at 1T25, has five CVM lines:

| Segment | Line |
|---|---|
| Mercados | 3.01.01 |
| Soluções Analíticas de Dados (Trillia) | 3.01.02 |
| Soluções para o Mercado de Capitais | 3.01.03 |
| Tecnologia & Plataformas | 3.01.04 |
| Outras receitas ("Reversão de Provisões e Recuperação de Despesas") | 3.01.05 |

**Accepted label variants.** Each was verified by value to be the same concept:

- "Tecnologia & Serviços" (1T25);
- the name with or without "(Trillia)";
- "Reversão de Provisão".

Unknown labels invalidate the snapshot.

**History.** It starts with FY2024 (the restated comparative in DFP 2025). The
pre-2025 taxonomy is recognised and skipped; we never create our own back-cast.
The workbook's own back-cast to 1T20 is not merged into the CVM series.

**Single-filing snapshots.** Each snapshot is one period from one filing: the
latest quarter, the current YTD, or a fiscal year. The sum of its lines must
equal 3.01 of the same filing and period, within R$1 thousand, or the whole
snapshot is rejected.

**No segment TTM.** B3 restates comparative allocations. For example, 1S25
Tecnologia & Plataformas was R$920.1mn as filed in 2T25 and R$913.5mn as restated
in 2T26. Combining filings would invent segment values that no filing reports.
Company-level net revenue TTM is fine, because totals are not restated.

## Official operating KPIs (quarterly workbook)

**Parser.** The parser locates blocks by sheet name and bilingual block title. It
validates the PT/EN quarter header pair ("2T26"/"2Q26") and requires every block
to agree on the latest quarter. It finds rows by PT label, PT unit and EN unit;
it never relies on fixed cell addresses.

It fails closed on any layout change. A missing optional KPI becomes null with an
issue.

| Metric | Source row | 2T26 |
|---|---|---|
| Listed derivatives ADV | Derivatives › Geral › ADV total (milhares de contratos) | 11,097.9 thousand/day |
| Listed derivatives RPC | Derivatives › Geral › RPC média (R$) | R$1.1801 |
| Cash equities ADTV | Equities › Ações à vista › ADTV (R$ milhões) | R$31,309.8mn/day |
| Cash equities fee margin | Equities › Ações à vista › Margem (bps) | 3.074 bps |
| Fixed income & credit average stock — banking instruments | Fixed Income › Estoque › Captação bancária (R$ bn) | 5,431.1 |
| Fixed income & credit average stock — corporate bonds | Fixed Income › Estoque › Dívida corporativa (R$ bn) | 1,466.5 |
| Fixed income & credit average stock — other | Fixed Income › Estoque › Outros (R$ bn) | 2,789.6 |

B3 publishes no aggregate of the three stocks, so none is computed. The UI must
show the three official components.

**Secondary metrics:**

- OTC derivatives average stock;
- securities-lending average open interest;
- Tesouro Direto average stock;
- the quarter's expense breakdown. It is kept only when its lines add up to
  "Despesas" and "Despesas" equals CVM 3.04.02 for the quarter.

**Cross-check.** A workbook snapshot is accepted only when its "Receita total"
equals the CVM consolidated gross revenue of the **same quarter**.

- The tolerance is `REVENUE_CROSS_CHECK_RELATIVE_TOLERANCE` = 0.01% of the CVM
  quarter's 3.01, with a floor of R$2 thousand (two R$-thousand rounding units).
  At 2T26 it is R$308,139.2.
- A boundary test proves that ±R$308,139 passes and ±R$308,140 fails. The
  tolerance must not be loosened.
- The actual difference at 2T26 was 0.

A workbook is never paired with statements of another quarter.

**Take rates are B3's own** (RPC, margins in bps). This model never divides
revenue by volume, and builds no combined exchange take rate.

**Methodology notes:**

- The workbook's notes on retroactively adjusted (yellow) figures are kept.
- Hedge-accounting effects are disclosed by B3; values stay as reported.
- **SNG pass-through.** `SNG_PASS_THROUGH_START_PERIOD = "2026-Q1"`, because B3's
  1T26 and 2T26 releases state that unified SNG billing began in 1T26. It raises
  gross revenue and revenue-linked expenses by the same amount. Periods from that
  quarter get a note; there is no adjusted series, and net revenue remains the
  scale measure.

## TTM

TTM at quarter n = YTD(n) + FY(year−1) − YTD(n, year−1), each from its own
filing. At Q4, TTM = FY. Any missing input gives null.

The same rule applies to:

- net revenue;
- operating result and EBITDA;
- attributable net income (3.11.01 only, never 3.11);
- distributions and buybacks;
- capex;
- taxes.

YoY growth compares the TTM with the TTM ending one year earlier.

## Indicators

**CORE:**

- net revenue TTM and its YoY growth;
- gross revenue (quarter);
- current segment mix;
- derivatives ADV and RPC;
- cash-equities ADTV and fee margin (bps);
- fixed-income and credit average stocks: banking instruments, corporate bonds and
  other, as three separate figures (no sum);
- operating margin;
- EBITDA TTM and EBITDA margin;
- attributable net income TTM;
- gross debt;
- managed net financial position;
- gross debt / EBITDA TTM;
- distributions TTM;
- buybacks TTM;
- outstanding-share change over 12 months. A split between the two dates makes it
  null.

**SECONDARY:**

- expense composition;
- capex TTM;
- ROE: attributable net income TTM / average attributable equity (2.03 − 2.03.09)
  at the start and end of the 12 months. B3's equity is dominated by goodwill and
  reduced by buybacks and cancellations.
- effective tax rate;
- OTC derivatives, securities-lending and Tesouro Direto stocks.

**One-off flag.** When non-recurring operating lines (3.04.03–3.04.05) reach 1% or
more of TTM attributable net income, a descriptive `oneOffFlag` is set. Earnings
are never adjusted.

Company-adjusted recurring EBITDA and net income are omitted in Phase 1.

### Rejected

- **Gross margin**: 3.02 holds revenue taxes, not costs.
- **Naïve net debt and current liquidity**: they would include third-party balances.
- **CVM operating cash flow as a performance measure, industrial FCF, FCF yield and
  cash conversion**: the CVM figure mixes in investment and collateral flows.
- **EV/EBIT, EV/Revenue, P/L headline**: EV depends on a net-debt definition, and
  valuation is out of scope.
- **ROIC and return on tangible equity**: invested capital is dominated by goodwill,
  and tangible equity is negative.
- **Derived take rates**: only B3's own unit economics are used.
- **Segment TTM**: B3 restates comparative allocations.
- **"Free cash" built by guessing earmarked-resource exclusions.**

## Reference dates

Each date is kept separately; no simultaneity is implied:

- statementReferenceDate;
- filingDate;
- filingVersion;
- segmentReferencePeriod;
- workbookQuarter;
- workbookPublicationDate (MZ `file_published_date`; `file_date` is unreliable);
- financialPositionReferenceDate;
- shareCountReferenceDate;
- capitalAllocationReferencePeriod.

## Freshness and readiness (Phase 1 diagnostic only)

Freshness compares source periods with each other, never with today's date.

| Candidate | Conditions |
|---|---|
| `analysis_ready` | Identity valid. The latest consolidated statement has its core accounts. The financial position is classified. The latest-filing segments are valid. A workbook snapshot of the same quarter is cross-checked. Nothing is preserved. |
| `analysis_limited` | Statements are usable, but KPIs are preserved, stale or failed; the segment taxonomy is unrecognised; or the managed position is unavailable. |
| `cache_pending` | No cache, a wrong identity or schema, or no valid consolidated statement. |

Routing does not use this diagnostic yet.

## Failure and preservation

| CVM | Workbook | Result |
|---|---|---|
| ok | ok | Statements advance. The workbook is accepted only after its same-quarter cross-check. |
| ok | fails or is rejected | Statements advance. The previous validated KPI snapshot is kept, marked `preserved`. |
| fails | ok | The previous statement history is kept. The workbook is accepted only if that history has its quarter. |
| fails | fails | Nothing is written. |

Further rules:

- With no previous cache, the precompute writes only when CVM succeeds.
- Statement history merges by period, so it never shrinks.
- An older workbook never replaces a newer one.
- A segment taxonomy change invalidates only the latest-filing segment block
  (`enrichment.segments = "failed"`).
- A missing optional KPI becomes null.
