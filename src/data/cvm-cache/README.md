# CVM Cache

Precomputed JSON snapshots of CVM financial and document data for all covered tickers.

Generated from CVM Dados Abertos (dados.cvm.gov.br) DFP and ITR ZIP files.

## Structure

```
cvm-cache/
  financials/   <TICKER>.json   — NormalizedFinancials[] for each fiscal year (DFP annual)
  documents/    <TICKER>.json   — CvmDocument[] (most recent CVM filings)
  quarterly/    <TICKER>.json   — QuarterlyFinancialRecord[] for each quarter (ITR)
```

## Annual cache (DFP)

```bash
npm run cvm:precompute
```

Fetches DFP annual data from CVM and overwrites `financials/` and `documents/`.
Run after each annual reporting season (typically April–May).

## Quarterly cache (ITR)

```bash
npm run cvm:precompute:quarterly
```

Fetches ITR quarterly data from CVM and writes `quarterly/<TICKER>.json`.
Run after each quarterly filing period (Q1: May, Q2: August, Q3: November).

ITR flow metrics (revenue, EBIT, operating cash flow, capex) are stored as true
quarterly values after de-accumulation of CVM's year-to-date cumulative figures.
Balance sheet metrics (cash, debt) are point-in-time at each quarter end.
Q4 is derived as `annual DFP value − Q3 ITR cumulative` when both are available.

This cache is infrastructure for the future Forecast Layer. It is not currently
displayed in the dashboard.

## What to commit

- **Commit**: compact normalized JSON files in `financials/`, `documents/`, and `quarterly/`.
- **Do not commit**: raw CVM ZIP files. DFP ZIPs are ~13 MB/year; ITR ZIPs are
  ~33 MB/year. These are downloaded at generation time and never written to disk.
