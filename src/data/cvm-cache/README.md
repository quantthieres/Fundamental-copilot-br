# CVM Cache

Precomputed JSON snapshots of CVM financial and document data for all covered tickers.

Generated from CVM Dados Abertos (dados.cvm.gov.br) DFP ZIP files.

## Structure

```
cvm-cache/
  financials/   <TICKER>.json   — NormalizedFinancials[] for each fiscal year
  documents/    <TICKER>.json   — CvmDocument[] (most recent filings)
```

## Regenerating

```
npm run cvm:precompute
```

This fetches live data from CVM and overwrites all cache files. Run periodically
(e.g., after each quarterly filing season) to keep the cache fresh.
