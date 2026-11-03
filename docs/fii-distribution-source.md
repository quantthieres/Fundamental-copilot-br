# FII distribution source

How monthly FII distributions (`monthlyDistributionPerShare`) are sourced,
matched and audited. Researched and implemented 2026-11-03.

**In short:**
- **Distributions:** B3 Fundos.Net structured notices are the only source.
- **NAV, patrimônio and cotas:** the CVM informe mensal stays authoritative.
- **CVM-derived distribution:** diagnostic only, never shown or counted.
- **Freshness:** the latest distribution month may be newer than the latest
  NAV month.
- **Outages:** a temporary Fundos.Net failure still refreshes NAV from CVM
  and carries over the last validated Fundos.Net distributions unchanged.
  There is no switch to estimated distributions.

## Why the CVM informe mensal alone was insufficient

NAV, quotas and NAV per share come from the CVM FII informe mensal
(`inf_mensal_fii_complemento_YYYY.csv`). The informe has no distribution
amount; the old pipeline estimated it as
`Percentual_Dividend_Yield_Mes × Valor_Patrimonial_Cotas`.

- Some administrators file 0 in every percentage field. BTHF11 did from
  2026-04, and IRIM11 did in every month except 2025-06, although both paid
  monthly. The CSV has no "not reported" marker, so the parser turns 0 into
  null, which left BTHF11 at 6/12 and IRIM11 at 0/12 usable months.
- Where the field is filled it is often not distribution ÷ NAV. Compared with
  the declared amounts, MXRF11 is off by up to 25 %, XPML11 swings between
  −6.52 and 1.47 against a steady R$0.92, and HGRE11 Jan-2026 shows 8.52
  against R$0.85.

## Official source: B3 Fundos.Net structured notices

FIIs report cash distributions in the structured form **Aviso aos Cotistas -
Estruturado / Rendimentos e Amortizações** on B3's Fundos.Net (FNET). Only
these public endpoints are used. None needs authentication.

| Purpose | Endpoint | Returns |
|---|---|---|
| Discovery | `GET https://fnet.bmfbovespa.com.br/fnet/publico/pesquisarGerenciadorDocumentosDados?d=1&s=<offset>&l=100&o[0][dataEntrega]=desc&cnpjFundo=<14 digits>&idCategoriaDocumento=14&idTipoDocumento=41&idEspecieDocumento=0&tipoFundo=1` | JSON `{data, recordsTotal, recordsFiltered, draw}` |
| Document | `GET https://fnet.bmfbovespa.com.br/fnet/publico/downloadDocumento?id=<id>` | `text/xml` (UTF-8, CRLF) |

**Listing rows** carry:
- `id`
- `categoriaDocumento` ("Aviso aos Cotistas - Estruturado")
- `tipoDocumento` ("Rendimentos e Amortizações")
- `dataEntrega` (announcement, `dd/mm/yyyy hh:mm`)
- `dataReferencia`
- `versao`
- `descricaoModalidade` ("Apresentação" / "Reapresentação Espontânea")
- `status` with `situacaoDocumento`:
  - `AC`/`A`: active
  - `IC`/`I`: inactive, replaced by a reapresentação
  - `CC`/`C`: cancelled

The listing does not link a reapresentação to the version it replaces. The XML
carries no status at all, so status always comes from the listing.

**Document XML.** Every notice filed since 2024 uses this schema: 314 notices
of the nine current funds, plus the latest 200 notices market-wide.

```xml
<DadosEconomicoFinanceiros>
  <DadosGerais>
    <NomeFundo/> <CNPJFundo/> <NomeAdministrador/> <CNPJAdministrador/>
    <ResponsavelInformacao/> <TelefoneContato/> <DataInformacao/> <Ano/>
  </DadosGerais>
  <InformeRendimentos>
    <Provento>                                   <!-- one per ISIN -->
      <CodISIN/> <CodNegociacao/>
      <Rendimento>                               <!-- optional -->
        <AtoSocietarioAprovacao/> <DataBase/> <ValorProvento/>
        <DataPagamento/> <PeriodoReferencia/> <RendimentoIsentoIR/>
      </Rendimento>
      <Amortizacao tipo="Parcial|Total">         <!-- optional -->
        <AtoSocietarioAprovacao/> <DataBase/> <ValorProvento/>
        <DataPagamento/> <PeriodoReferencia/>
      </Amortizacao>
    </Provento>
  </InformeRendimentos>
</DadosEconomicoFinanceiros>
```

- **Several ISINs per notice.** One notice can list several `Provento` blocks:
  the traded quota plus subscription receipts. KNCR11 1025876 has 9 ISINs
  (KNCR11, KNCR13–KNCR20); MXRF11 1050431 has 4.
- **One notice can carry both event types.** VIDS11 1365813 has a rendimento
  and a partial amortização in the same `Provento`; REME11 1364168 carries
  only an amortização.
- **Values are dot-decimal.** No zero-valued event appears in any sampled
  notice; a fund with nothing to distribute files no notice. An explicit
  `0` would still be kept as 0, while a missing or malformed value is null.
- **The pre-2023 schema is not supported.** It put the ISIN in `DadosGerais`
  and used `ValorProventoCota` with a separate `Ano`. It is rejected as
  unsupported, never guessed.

## Identity matching

Matching is exact and never uses fund names:

- **CNPJ.** The notice's `CNPJFundo` must equal the fund CNPJ, taken from the
  existing exact `FII_CNPJ_OVERRIDES` or CVM mapping. Discovery also searches
  by that CNPJ.
- **ISIN.** `CodISIN` must equal the traded quota's ISIN. That ISIN comes from
  `Codigo_ISIN` in the CVM informe geral (latest row), unless
  `FII_ISIN_OVERRIDES` sets it.
- **Ticker.** `CodNegociacao` must equal the ticker.

Other quotas of the same fund, such as receipts, are ignored. A notice that
matches on ticker but not on ISIN, or the other way round, is rejected and
reported.

**One ISIN override, BTHF11 → BRBTHFCTF000.** It records the ISIN of the
quota that actually trades, used only to match distribution notices. The
evidence:
- **CNPJ:** every BTHF11 notice is filed under CNPJ 45.188.176/0001-57, the
  fund's exact CNPJ (`FII_CNPJ_OVERRIDES`).
- **Ticker and ISIN:** every active notice for that CNPJ gives
  `CodNegociacao` BTHF11 with `CodISIN` BRBTHFCTF000.
- **The other ISIN:** the informe geral lists BR0EI9CTF007 for this CNPJ.
  That ISIN appears in a single notice, 874862 (code `4770023FII`, Mar-2025),
  which the administrator later cancelled.

Matching stays strict on CNPJ, ticker and ISIN. A regression test checks that
BR0EI9CTF007 never matches BTHF11, even if notice 874862 were active.

IRDM11 (28.830.325/0001-10) and IRIM11 (41.076.564/0001-95) are separate
identities, and no alias links them.

## Month assignment

Each event is assigned to the month named in `PeriodoReferencia`, which is
its competence month. The data base (data-com) and payment dates are kept only
as provenance.

**Why the competence month.** The CVM informe reports a distribution under its
competence month. Funds whose data base falls at month-end (HGLG11, KNRI11,
VISC11, KNCR11, HGRE11) match the CVM estimate in 17–21 of 21 months under
either rule. The two rules come apart when the data base falls in the next
month:
- **IRIM11:** the only CVM value (2025-06, 0.899) equals the Jun-2025 notice
  (0.90, data base 2025-07-09), not July's.
- **BTHF11:** competence assignment matches more months than data-base
  assignment does.

Bucketing by publication month would shift every lagged fund by one month.

**Formats parsed:**
- "Setembro-2026"
- "OUTUBRO 2025"
- "05/2025"
- a bare month name ("OUTUBRO", "junho"), dated to the latest such month on or
  before the data base

**Rejected and reported** (never guessed): any other text, or a competence
month after the data base.

**Records.** The cache holds the union of CVM months and Fundos.Net months,
from the first CVM month on. A Fundos.Net month newer than the latest informe
gets a record with `source: "fii_fnet_only"` and null NAV, quota and NAV per
share fields; NAV is never invented. Month-end payers already have Oct-2026
distributions while NAV is through Sep-2026.

**Readers.** Never read NAV from "the last record". The helpers in
`fii-indicators.ts` are:
- `latestRecordWithNav` and `latestRecordWithQuotaCount`, for VP/cota, P/VP,
  patrimônio and cotas;
- `latestDistributionReferenceMonth` and `distributionWindowMonths`, for the
  last distribution, the 12m sum, DY 12m and coverage.

**12-month window.** Twelve consecutive calendar months ending at the latest
distribution reference month. A month with a Fundos.Net value (0 included)
counts as covered; a missing notice or a missing record is a missing month.

**Freshness.** `FII_MAX_DISTRIBUTION_LAG_MONTHS = 1`: the latest distribution
reference month may trail the latest NAV reference month by at most one
calendar month. The rule compares the two sources' reference months, never the
wall clock.

| Latest NAV | Latest distribution | Result |
|---|---|---|
| 2026-10 | 2026-09 | fresh |
| 2026-11 | 2026-09 | stale |
| 2026-09 | 2026-10 | valid (distribution newer than NAV) |

A stale fund keeps its complete 12-month window, but readiness drops to
`analysis_limited` and the panel shows a short notice.

**UI.** The panel shows "VP: 09/2026 · Rendimentos até: 10/2026", and the
report labels VP and the last distribution with their own reference months.

## Distribution and amortization

- `monthlyDistributionPerShare` is the sum of the fund's rendimento events for
  the month. Several separate events in one month are summed, rounded to
  1e-10 for stable output.
- `monthlyAmortizationPerShare` holds amortização events, kept apart.
- Amortization never enters the distribution, last distribution, 12m
  distribution or DY 12m. No current cached FII had an amortization in its
  window.

## Republication and cancellation

- Only active (`AC`) notices contribute.
- Superseded (`IC`) and cancelled (`CC`) notices are never downloaded and never
  count. This is decided from the listing status, not ingestion order.
- **Duplicates.** If two active notices report the same event (same kind,
  month and data base for the quota), the higher `versao` wins, then the later
  `dataEntrega`, then the higher `id`. The dropped one is listed in
  `distributionEnrichment.issues`.

Real cases:

| Case | Notices | Outcome |
|---|---|---|
| BTHF11 Dec-2025 reapresentação | 1077689 (v1, R$0.092, `IC`) → 1077704 (v2, R$0.10599) | R$0.10599 |
| MXRF11 Jul-2024 cancellation | 709287 (`CC`) re-filed as 709356 (`AC`) | counted once |
| MXRF11 Oct-2025 reapresentação | 1026624 (v2) | changed the payment date only |

## Distribution semantics

Per month, `monthlyDistributionPerShare` is:
1. the Fundos.Net rendimento for the traded quota, an explicit 0 included;
2. otherwise null. Zeros are never invented.

The CVM estimate (`Percentual_Dividend_Yield_Mes × Valor_Patrimonial_Cotas`)
is stored only as `cvmDerivedDistributionEstimate`. It never enters the
distribution, the 12m sum, DY 12m, coverage or readiness, and it is never
displayed as a paid amount. It was dropped as a fallback because it is
materially wrong too often (see the audit).

## Failure behavior (per ticker)

`refreshFiiDistributions` (`src/lib/fiis/fii-distribution-refresh.ts`) decides
for each ticker. A **technical failure** is any of:
- the listing throws (HTTP error or unexpected payload);
- an active notice cannot be downloaded or parsed;
- the listing returns no notices although the committed cache has
  Fundos.Net months.

| Situation | Written cache |
|---|---|
| Technical failure; committed cache has Fundos.Net months | **preserved**: see below |
| Technical failure; no earlier Fundos.Net data (new fund) | fresh CVM NAV data, every distribution null, `status: "failed"` with the reason in `issues`, a short Portuguese warning; the global rule gives `analysis_limited` |
| Data problems in readable notices (identity mismatch, unreadable period) | written normally; the problems go in `issues` and the affected months stay null |

A **preserved** cache has:
- **CVM data:** fresh NAV, NAV per share, quota count and diagnostic estimate.
- **Fundos.Net data:** every distribution, amortization, data base, payment
  date and document id copied unchanged from the committed cache, month by
  month.
- **No new distributions:** a month the committed cache had no Fundos.Net
  value for stays null.
- **Status:** `status: "preserved"`, with the issue "Fundos.Net unavailable
  (…); prior authoritative distribution data preserved" and the Portuguese
  warning "… mantidos os rendimentos já publicados".

The run continues for the other tickers. `fii:precompute` exits 0 and emits a
GitHub `::warning::` annotation, so FII NAV and the industrial, bank,
insurance and forecast refreshes all proceed.

As a backstop, `cache-refresh-guard` still rejects any modified FII cache that
loses Fundos.Net provenance for a month it previously had.

## Provenance fields

Per record:

| Field | Meaning |
|---|---|
| `distributionSource` | `"fnet_structured"` or `null` (no distribution) |
| `cvmDerivedDistributionEstimate` | CVM diagnostic estimate; never a distribution |
| `source` | `"fii_cvm_cache"` (informe month) or `"fii_fnet_only"` (distribution only, NAV null) |
| `distributionBaseDate` | Fundos.Net data base (latest, if several events) |
| `distributionPaymentDate` | Fundos.Net payment date (latest, if several events) |
| `fnetDocumentIds` | notices behind the month (empty when none) |
| `monthlyAmortizationPerShare` | amortização per share, or null |

Per cache, `distributionEnrichment` records:
- `status`
- `isin`
- `noticesListed`
- `noticesUsed`
- `issues`

The UI shows only "Fonte: CVM Informe Mensal · Rendimentos: B3 Fundos.Net",
and only when at least one month came from Fundos.Net.

## Diagnostics tolerance

When both values exist, `compareDistributionSources` classifies the CVM
diagnostic estimate against the Fundos.Net amount. It is never used for
merging or fallback.

| Relative difference | Class |
|---|---|
| ≤ 0.5 % | match |
| ≤ 2 % | rounding (DY field precision) |
| > 2 % | material |

`npm run fii:audit:distributions` reports, for each current FII:
- latest NAV month;
- latest distribution month;
- the window;
- Fundos.Net months in it;
- missing months;
- months with a CVM diagnostic estimate (not counted);
- material discrepancies;
- readiness.

It exits 1 on provenance errors.

## Readiness

`analysis_ready` requires both of these, with no ticker exceptions:
- `FII_MIN_DISTRIBUTION_MONTHS = 12` covered months in the 12-month
  distribution window;
- a latest distribution no more than `FII_MAX_DISTRIBUTION_LAG_MONTHS = 1`
  month behind the latest NAV month.

Otherwise the fund is `analysis_limited`. A Fundos.Net 0 counts as covered; a
missing month does not; a CVM estimate never counts.

With Fundos.Net all nine current FIIs have 12/12, so BTHF11 and IRIM11 moved
from `analysis_limited` to `analysis_ready`.

## Scope and limits

- **Current funds only.** Historical codes (`TICKER_LIFECYCLE`, e.g. IRDM11)
  are skipped by `fii:precompute`; their caches are frozen.
- **Network at precompute time only.** No request path, server or browser,
  calls FNET.
- **Discovery depth.** Discovery pages back to two months before the first
  cached record, at most 10 pages of 100.
- **Not verified:**
  - funds that file only the pre-2023 schema;
  - non-monthly payers (semiannual funds are matched the same way but fewer
    months will be covered);
  - whether FNET ever publishes explicit-zero notices.
