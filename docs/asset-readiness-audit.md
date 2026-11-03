# Asset readiness audit

Answers, for every asset in `B3_UNIVERSE`: is it actually ready, limited,
intentionally limited, pending a model, in manual review, historical, or
missing its current successor?

Three separate questions, three separate tools:

| Question | Source of truth | Command |
|---|---|---|
| Does the page render safely? | `resolveModelRoute()` | `npm run report:audit` |
| Is the route correct for the asset type/caches? | `resolveModelRoute()` + registries | `npm run coverage:audit:models` |
| Is the asset covered at the intended product level? | `src/lib/coverage/asset-readiness.ts` | `npm run coverage:audit:readiness` |

A fallback page (quote-only / sector-specific pending) passes the first
question and fails the third. "All routes produce valid pages" never means
"all assets covered".

## Layers

- **Ticker lifecycle** (`src/lib/coverage/ticker-lifecycle.ts`): is the
  trading code current? `active | renamed | converted | incorporated |
  delisted | cancelled | invalid_code`, with successor, relation to the old
  issuer, effective date, intermediate codes, conversion ratio, evidence and a
  verification flag (all current entries verified).
  Historical codes stay in the universe with `coverageStatus: "unavailable"`.
- **Issuer identity** (`src/lib/coverage/issuer-identity.ts`): ticker →
  CD_CVM for every company ticker, used to group share classes and successors.
- **Fundamentals aliases** (`src/lib/coverage/fundamentals-alias.ts`): explicit
  aliases whose cached fundamentals are read under another ticker. The
  requested ticker, quote and share class stay ticker-specific (applied in the
  six server-side cache readers, the CVM/model/forecast APIs and
  `resolveModelRoute`). `company-map.ts` stays exact, so precompute never
  creates alias targets. Three reasons:
  - `same_issuer_share_class` — ITUB3 → ITUB4, BBDC3 → BBDC4;
  - `same_issuer_ticker_change` — same CD_CVM, cache still keyed by the former
    code (AXIA3, EMBJ3, ISAE4, SAUD3, AZZA3, MBRF3, AZUL3);
  - `issuer_transition_cache_from_current_issuer` — NATU3 → NTCO3 only (see
    below).
- **Readiness** (`src/lib/coverage/asset-readiness.ts`): taxonomy, explicit
  decisions (`READINESS_DECISIONS`) and industrial review flags.
- **Curation exclusions** (`CURATION_EXCLUSIONS` in `ticker-lifecycle.ts`):
  current B3 codes deliberately outside the universe.

## Where `coverageStatus` is authoritative

- `unavailable` — authoritative (historical codes; always paired with a
  lifecycle entry; the audit fails otherwise).
- `full_analysis` / `cvm_analysis` / `cvm_financials` vs `quote_only` —
  authoritative for selecting the industrial route of operating companies.
- `sector_specific_model_required` — metadata only. Banks, FIIs, insurers,
  ETFs and BDRs are routed by asset type and the model-cache registries.

## What is and is not verified

- Every universe entry has explicit readiness and lifecycle metadata
  (lifecycle defaults to "active"); readiness buckets always sum to the total.
- All 24 lifecycle links (historical code → current code or "no successor")
  are verified against official B3/CVM sources listed below.
- Issuer identity (CD_CVM) is verified for every company ticker and for every
  fundamentals alias; aliases are additionally tested to read a cache built
  from the right CVM entity.
- Company tickers were confirmed as current B3 codes (B3 `GetDetail`); BDRs via
  B3 `GetCompaniesBDR` (Alphabet: GOGL34, GOGL35).
- **Not exhaustively re-validated:** ETF tickers (fund classes exist in CVM-FI,
  but B3's fund endpoints returned no data) and FII ticker↔CNPJ links beyond
  the CNPJs already recorded in the FII caches.
- The universe is **curated**, not exhaustive: "0 current successors missing"
  means no historical code in the universe lacks its current code; other
  classes an issuer lists may be excluded by policy.

## Curation policy

The universe tracks the classes the product analyses, not every listed code.
A current class is excluded when it is transitional (temporary redemption or
conversion regime) or redundant for the product. Exclusions are recorded in
`CURATION_EXCLUSIONS` and printed by the audit:

- **AXIA7** (AXIA Energia PNC) — created by the Dec/2025 bonus issue and under
  a redemption/conversion programme into ON; AXIA3 is tracked as the principal
  class. AXIA7 is not the successor of ELET6.

## Research notes (hand-maintained — not overwritten by the audit)

Verified 2026-11-03. Sources:

- **CVM-REG** — `cad_cia_aberta.csv` (SIT, DT_CANCEL, MOTIVO_CANCEL, category).
- **CVM-FCA** — FCA `valor_mobiliario` 2020–2026 (trading codes per CNPJ,
  trading start/end dates).
- **B3** — listed-companies service (`GetDetail`: current trading codes per
  CD_CVM; `GetCompaniesBDR` for BDRs); company pages.
- **B3-OC** — B3 Ofícios Circulares (index/position treatment).
- **B3-NEWS** — B3 news and auction notices (Bora Investir, Plantão de
  Notícias, "Toque de campainha", editais de leilão).
- **CVM-FI** — `registro_classe.csv` (fund classes).
- Company notices are cited only for dates the B3/CVM sources above do not
  state directly (SAUD3 first session).

| Old | Current | Event | Effective | Source |
|---|---|---|---|---|
| RRRP3 | BRAV3 | renamed (same CNPJ) | 2023–2024 | CVM-FCA, B3 |
| ELET3 | AXIA3 | renamed (same CNPJ) | Nov/2025 | CVM-FCA, B3, B3-NEWS (Bora Investir) |
| ELET6 | AXIA3 via AXIA6 | renamed AXIA6 (Nov/2025), then converted 1.1 AXIA3 per AXIA6; AXIA6 not traded from 2026-06-08 | 2026-06-08 | B3-OC 035/2026-VNC, B3-NEWS (Plantão de Notícias 2026-06-01/03), B3 |
| ARZZ3 | AZZA3 | renamed (same CNPJ) | 2024-08-01 | CVM-FCA, B3-OC 012/2024 |
| SOMA3 | AZZA3 | incorporated by Arezzo&Co (Azzas 2154) | 2024-07-31 | CVM-REG, B3-OC 012/2024 |
| PETZ3 | AUAU3 | shares incorporated by União Pet (new CNPJ) | 2026-01-02 last trade | CVM-FCA, CVM-REG |
| VVAR3 | BHIA3 | renamed via VIIA3 (same CNPJ) | 2021 / 2023 | CVM-FCA |
| EMBR3 | EMBJ3 | renamed (same CD_CVM) | 2025-11-03 | CVM-FCA, B3, B3-NEWS (Plantão de Notícias "AJUSTES NOS INDICES DA B3 EM FUNCAO DE PROVENTOS 03/11/2025": valid for the 2025-11-03 opening, EMBJ3 included, EMBR3 excluded) |
| TRPL4 | ISAE4 | renamed (same CD_CVM) | 2024-11-18 | CVM-FCA, B3, B3-NEWS (Toque de campainha 2024-11-18) |
| ODPV3 | SAUD3 | renamed (same CD_CVM, Bradsaúde) | 2026-05-05 | CVM-FCA, B3, company notice; B3-NEWS (Bora Investir) |
| MRFG3 | MBRF3 | renamed (same CD_CVM) | 2025-09-23 | CVM-REG, B3, B3-OC 035/2025 |
| BRFS3 | MBRF3 | shares incorporated by Marfrig | 2025-09-22 last trade | CVM-FCA, CVM-REG, B3-OC 035/2025 |
| CPLE6 | CPLE3 | PNB converted (Novo Mercado) | 2025-11-10 | CVM-FCA, B3 |
| AZUL4 | AZUL3 | PN converted into ON (Chapter 11) | Jan/2026 | CVM-FCA, B3 |
| NTCO3 | NATU3 | holding incorporated by Natura Cosméticos (issuer transition) | 2025-07-01 | CVM-REG, B3 |
| JBSS3 | JBSS32 | replaced by BDRs of JBS N.V. | 2025-06 | B3 |
| SULA11 | RDOR3 | incorporated by Rede D'Or | 2022-12-23 last trade | B3-OC 189/2022 |
| CESP6 | AURE3 | CESP shares incorporated by Auren; AURE3 first session | 2022-03-28 | B3 (AURE3 company page), B3-NEWS (fractions auction notice 2022-04-07) |
| BCFF11 | BTHF11 | FII incorporated; residual fractions auctioned | auction 2025-01-09 | B3-NEWS ("Edital – Incorporação – BTHF11"), CVM-FI |
| ENBR3 | — | listing cancelled after delisting tender offer | 2023-07-11 | B3-OC 100/2023-PRE, CVM-FCA, CVM-REG |
| STBP3 | — | delisted, now CVM category B | 2025-10-03 (date per company notices) | CVM-REG, B3, B3-OC 034/2025 |
| GOLL4 | — | registration cancelled (taken private by Abra) | 2026-04-01 | CVM-REG |
| CRFB3 | — | registration cancelled | 2025-12-22 | CVM-REG |
| BRPR3 | — | registration cancelled | 2023-12-20 | CVM-REG |

### Alphabet BDRs

B3 lists Alphabet BDRs as **GOGL34** and **GOGL35** (issuer GOGL). The former
universe entry `GOOGL34` was never a valid B3 code: it is removed from the
universe and from readiness (it is not a historical security). GOGL35 was
added so both listed Alphabet classes stay covered by the informational layer.

### NATU3 / NTCO3 — issuer transition, not a rename

Natura &Co Holding (NTCO3, CD_CVM 24783) was incorporated by Natura Cosméticos
S.A. (NATU3, CD_CVM 19550) effective 2025-07-01; the holding's CVM registration
was cancelled retroactively to that date. These are different issuers. The
NATU3 → NTCO3 fundamentals alias is valid **only** because the committed NTCO3
cache is already sourced from CD_CVM 19550 (`company-map.ts`), i.e. from
NATU3's issuer — a regression test fails if that stops being true.

### Decisions recorded in `READINESS_DECISIONS`

- **ITSA3/ITSA4** — holding model pending; one issuer (Itaúsa, CD_CVM 7617).
  Never aliased to Itaú Unibanco.
- **BRAP4** — holding model pending (Bradespar).
- **ALOS3** — real-estate model pending; MULT3/IGTI11/JHSF3 flagged for review.
- **B3SA3** — market-infrastructure model pending.
- **VAMO3, SEQL3** — manual review (2024 reorganisation / ongoing restructuring).
- **AMBP3** — manual review (judicial recovery; FCA 2026 registered name).
  Previously "keep quote-only".
- **BHIA3** — manual review (judicial recovery; no cache under current code).
- **AZUL3** — manual review (Chapter 11 conversion and new equity).
- **CASH3** — intentionally limited (Bitcoin treasury strategy).

### Annual-year counts

`report:audit` and `coverage:audit:readiness` share `countUsableAnnualYears`
(distinct fiscal years with at least one numeric value). As committed on
2026-11-03: CGAS3 **0**, SAPR11 **0** (empty `financials` arrays), ASAI3 **1**
(FY2020 only). Earlier `report:audit` output said "1 year" for all three
because its label was hard-coded for any cache under two years.

### Follow-ups

- Re-key industrial caches under current codes (AXIA3, EMBJ3, ISAE4, SAUD3,
  AZZA3, MBRF3, AZUL3, NATU3) and retire the transitional aliases.
- Add verified CVM mappings + caches for BRAV3 (CD_CVM 25291) and AUAU3
  (CD_CVM 27766); BTHF11 needs a verified FII CNPJ before `fii:precompute`.
- Investigate why CGAS3/SAPR11 produce empty annual caches and ASAI3 a
  single year.

## Generated audit

<!-- BEGIN GENERATED: npm run coverage:audit:readiness -- --write-doc -->

```text
Total assets: 183 (curated universe — see curation exclusions below)

Analysis ready                        128
Analysis limited                      3
Informational ready                   14
Intentionally limited                 1
Manual review                         5
Model pending                         5
Cache pending (model exists)          3
Historical/unavailable                24
Current successor missing (curated)   0
Sum of buckets                        183 (= total)

Distinct issuers analysis-ready: 123

## MODEL DEVELOPMENT PROJECTS (grouped by issuer)
- Holding model: 2 issuer(s) pending, 2 industrial review candidate(s)
    pending  Bradespar S.A. — BRAP4
    pending  Itaúsa S.A. — ITSA3, ITSA4
    review   Cosan S.A. — CSAN3 (currently industrial)
    review   Metalúrgica Gerdau S.A. — GOAU4 (currently industrial)
- Market-infrastructure model: 1 issuer(s) pending
    pending  B3 S.A. – Brasil, Bolsa, Balcão — B3SA3
- Real estate / shopping-center model: 1 issuer(s) pending, 3 industrial review candidate(s)
    pending  Allos S.A. — ALOS3
    review   Multiplan Empreendimentos Imobiliários S.A. — MULT3 (currently industrial)
    review   Iguatemi S.A. — IGTI11 (currently industrial)
    review   JHSF Participações S.A. — JHSF3 (currently industrial)

## CURRENT-TICKER MAINTENANCE (historical code → current code)
- ARZZ3    renamed       → AZZA3  (2024-08-01)
- AZUL4    converted     → AZUL3
- BCFF11   incorporated  → BTHF11
- BRFS3    incorporated  → MBRF3  (2025-09-22)
- BRPR3    cancelled     (no B3 successor)  (2023-12-20)
- CESP6    incorporated  → AURE3  (2022-03-28)
- CPLE6    converted     → CPLE3  (2025-11-10)
- CRFB3    cancelled     (no B3 successor)  (2025-12-22)
- ELET3    renamed       → AXIA3
- ELET6    converted     → AXIA3 via AXIA6  (2026-06-08)  [1.1 AXIA3 per AXIA6]
- EMBR3    renamed       → EMBJ3  (2025-11-03)
- ENBR3    delisted      (no B3 successor)  (2023-07-11)
- GOLL4    cancelled     (no B3 successor)  (2026-04-01)
- JBSS3    converted     → JBSS32
- MRFG3    renamed       → MBRF3  (2025-09-23)
- NTCO3    incorporated  → NATU3  (2025-07-01)  [1 NATU3 per NTCO3]
- ODPV3    renamed       → SAUD3  (2026-05-05)
- PETZ3    incorporated  → AUAU3  (2026-01-02)
- RRRP3    renamed       → BRAV3
- SOMA3    incorporated  → AZZA3  (2024-07-31)
- STBP3    delisted      (no B3 successor)  (2025-10-03)
- SULA11   incorporated  → RDOR3
- TRPL4    renamed       → ISAE4  (2024-11-18)
- VVAR3    renamed       → BHIA3

## CURATION EXCLUSIONS (current B3 codes intentionally outside the curated universe)
- AXIA7 (issuer tracked as AXIA3): Transitional PNC class (bonus issue Dec/2025) under a redemption/conversion programme into ON; the curated universe tracks AXIA3, the principal class. Not the successor of ELET6.

## FUNDAMENTALS ALIASES (quote stays ticker-specific)
- AXIA3 → ELET3 (same_issuer_ticker_change)
- AZUL3 → AZUL4 (same_issuer_ticker_change)
- AZZA3 → ARZZ3 (same_issuer_ticker_change)
- BBDC3 → BBDC4 (same_issuer_share_class)
- EMBJ3 → EMBR3 (same_issuer_ticker_change)
- ISAE4 → TRPL4 (same_issuer_ticker_change)
- ITUB3 → ITUB4 (same_issuer_share_class)
- MBRF3 → MRFG3 (same_issuer_ticker_change)
- NATU3 → NTCO3 (issuer_transition_cache_from_current_issuer)
- SAUD3 → ODPV3 (same_issuer_ticker_change)

## MANUAL REVIEW
- VAMO3 — Vamos Locações S.A. — active — route=quote_only
    reason: 2024 reorganisation (dealerships segregated into Automob/AMOB3) breaks 2020–2023 comparability; fleet purchases in operating cash flow distort industrial FCF
    next:   Re-assess comparability before enabling a model
- AZUL3 — Azul S.A. — active — route=industrial fundamentals=AZUL4
    reason: Chapter 11 restructuring: all PN converted into ON (Jan/2026) and new equity issued — per-share history is not comparable
    next:   Re-assess comparability before enabling a model
- SEQL3 — Sequoia Logística e Transportes S.A. — active — route=quote_only
    reason: Extrajudicial recovery (2024), reverse splits, change of control and debt renegotiation (2026) — wait for stabilisation
    next:   Re-assess comparability before enabling a model
- BHIA3 — Grupo Casas Bahia S.A. — active — route=quote_only
    reason: Grupo Casas Bahia is in judicial recovery; no CVM cache under the current code yet (VVAR3/VIIA3 history not cached)
    next:   Re-assess comparability before enabling a model
- AMBP3 — Ambipar Participações e Franquias S.A. — active — route=quote_only
    reason: Judicial recovery (recuperação judicial) since 2025-10-30 — restructuring prevents normal model use
    next:   Re-assess comparability before enabling a model

## INTENTIONALLY LIMITED
- CASH3 — Méliuz S.A. — active — route=quote_only
    reason: Business model pivoted to a Bitcoin treasury strategy (2025–2026) — industrial metrics would mislead

## MODEL PENDING
- BRAP4 — Bradespar S.A. — active — route=quote_only
    reason: Bradespar is a pure holding whose main asset is a Vale stake — industrial DFP metrics do not describe it
    next:   Build the holding model
- ALOS3 — Allos S.A. — active — route=quote_only
    reason: Shopping-center owner: needs NOI/FFO/NAV metrics; extracted DFP showed total debt = 0 and 2023 EBIT ≈ 2× revenue (combination gain)
    next:   Build the real estate / shopping-center model
- B3SA3 — B3 S.A. – Brasil, Bolsa, Balcão — active — route=quote_only
    reason: Exchange/clearing operator — revenue and balance sheet (collateral, clearing) need a market-infrastructure model
    next:   Build the market-infrastructure model
- ITSA4 — Itaúsa S.A. — active — route=sector_specific_pending
    reason: Itaúsa is a holding (equity-accounted stakes in Itaú Unibanco and non-financial companies) — not a bank and not an operating company
    next:   Build the holding model
- ITSA3 — Itaúsa S.A. — active — route=sector_specific_pending
    reason: Itaúsa is a holding (equity-accounted stakes in Itaú Unibanco and non-financial companies) — not a bank and not an operating company
    next:   Build the holding model

## CACHE PENDING (MODEL EXISTS)
- BRAV3 — Brava Energia S.A. — active — route=quote_only
    reason: operating company without a verified CVM mapping/cache under this code
    next:   Verify CVM identity, add company-map entry and run cvm:precompute
- AUAU3 — União Pet Participações S.A. — active — route=quote_only
    reason: operating company without a verified CVM mapping/cache under this code
    next:   Verify CVM identity, add company-map entry and run cvm:precompute
- BTHF11 — BTG Pactual Real Estate Hedge Fund FII — active — route=sector_specific_pending
    reason: fii model exists but no available:true cache for this ticker
    next:   Verify identity and run fii:precompute

## ANALYSIS LIMITED
- CGAS3 — Comgás – Companhia de Gás de São Paulo — active — route=industrial
    reason: annual CVM cache has 0 fiscal year(s)
    next:   Investigate missing DFP history
- SAPR11 — Sanepar – Companhia de Saneamento do Paraná — active — route=industrial
    reason: annual CVM cache has 0 fiscal year(s)
    next:   Investigate missing DFP history
- ASAI3 — Assaí Atacadista S.A. — active — route=industrial
    reason: annual CVM cache has 1 fiscal year(s)
    next:   Investigate missing DFP history

## INDUSTRIAL MODEL REVIEW CANDIDATES (flagged, not reclassified)
- CSAN3 — Holding model: Holding with equity-accounted (Raízen) and consolidated stakes; part of value sits outside consolidated DFP
- GOAU4 — Holding model: Holding of Gerdau (consolidated) — double-counts GGBR3/GGBR4 fundamentals
- MULT3 — Real estate / shopping-center model: Shopping-center owner (same business as ALOS3, which is excluded)
- IGTI11 — Real estate / shopping-center model: Shopping-center owner (same business as ALOS3, which is excluded)
- JHSF3 — Real estate / shopping-center model: Shopping centers, real-estate development and hospitality mix

## STATIC coverageStatus CONSISTENCY
(coverageStatus is authoritative only for 'unavailable' and for industrial vs quote_only route selection;
 for banks/FIIs/insurers/ETFs/BDRs the route comes from the model-cache registries and the status is metadata)
- CGAS3: declared cvm_analysis but the annual CVM cache has 0 fiscal year(s) — readiness reports analysis_limited
- SAPR11: declared cvm_analysis but the annual CVM cache has 0 fiscal year(s) — readiness reports analysis_limited

## READY / INFORMATIONAL / HISTORICAL (tickers)
- Analysis ready (128): WEGE3 EMBJ3→EMBR3 TUPY3 FRAS3 MYPK3 ROMI3 RAPT4 KEPL3 POMO4 TASA4 LEVE3 AERI3 PETR4 PETR3 PRIO3 VBBR3 RAIZ4 RECV3 CSAN3 UGPA3 VALE3 CMIN3 GGBR4 GGBR3 GOAU4 CSNA3 USIM5 FESA4 BRKM5 UNIP6 SUZB3 KLBN11 DXCO3 EGIE3 CPFE3 AXIA3→ELET3 EQTL3 ENEV3 CMIG4 CMIG3 CPLE3 ALUP11 TAEE11 ISAE4→TRPL4 AURE3 ENGI11 SBSP3 CSMG3 VIVT3 TIMS3 ABEV3 MBRF3→MRFG3 BEEF3 SMTO3 MDIA3 SLCE3 AGRO3 RENT3 RAIL3 MOVI3 TGMA3 SIMH3 LOGN3 LREN3 MGLU3 PCAR3 SBFG3 AZZA3→ARZZ3 GRND3 VULC3 GMAT3 ALPA4 LJQQ3 PTBL3 CYRE3 MRVE3 CURY3 PLPL3 EVEN3 DIRR3 TEND3 GFSA3 MTRE3 MULT3 IGTI11 JHSF3 ITUB4 ITUB3→ITUB4 BBDC4 BBDC3→BBDC4 BBAS3 BPAC11 SANB11 BRSR6 BBSE3 PSSA3 IRBR3 CXSE3 HAPV3 RDOR3 RADL3 HYPE3 FLRY3 SAUD3→ODPV3 QUAL3 BLAU3 COGN3 YDUQ3 SEER3 CSED3 ANIM3 NATU3→NTCO3 SMFT3 CVCB3 VLID3 PRNR3 TOTS3 INTB3 LWSA3 POSI3 MXRF11 XPML11 HGLG11 KNRI11 VISC11 IRDM11 KNCR11 HGRE11
- Informational ready (14): BOVA11 IVVB11 SMAL11 HASH11 SPXI11 GOLD11 AAPL34 MSFT34 TSLA34 AMZO34 GOGL34 GOGL35 NVDC34 JBSS32
- Historical/unavailable (24): EMBR3⇒EMBJ3 RRRP3⇒BRAV3 ELET3⇒AXIA3 ELET6⇒AXIA3 CPLE6⇒CPLE3 TRPL4⇒ISAE4 CESP6⇒AURE3 ENBR3 BRFS3⇒MBRF3 JBSS3⇒JBSS32 MRFG3⇒MBRF3 AZUL4⇒AZUL3 GOLL4 STBP3 CRFB3 SOMA3⇒AZZA3 ARZZ3⇒AZZA3 PETZ3⇒AUAU3 VVAR3⇒BHIA3 BRPR3 SULA11⇒RDOR3 ODPV3⇒SAUD3 NTCO3⇒NATU3 BCFF11⇒BTHF11
```

<!-- END GENERATED -->
