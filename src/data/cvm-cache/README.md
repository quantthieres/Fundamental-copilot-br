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

```bash
npm run cvm:precompute
```

This fetches live data from CVM and overwrites all cache files. Run periodically
(e.g., after each quarterly filing season) to keep the cache fresh.

## What to commit

- **Commit**: the compact normalized JSON files in `financials/` and `documents/`.
- **Do not commit**: raw CVM ZIP files (~13 MB per year). These are held in memory
  only by the server and are never written to disk — the precompute script reads
  them directly from CVM Dados Abertos at generation time.
