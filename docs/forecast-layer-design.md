# Forecast Layer — Technical Design Document

**Project:** Fundamental Copilot BR  
**Status:** Phase 5 (Forecast quality diagnostics) implemented. Statistical models and TimesFM not yet implemented.  
**Date:** 2026-05-15  
**Scope:** Quantitative projection of company fundamentals using precomputed offline forecasting

> **Phase 1 (CVM ITR quarterly data pipeline) is implemented.** This includes `src/lib/cvm/itr-client.ts`, `src/lib/cvm/itr-quarterly.ts`, precomputed quarterly cache at `src/data/cvm-cache/quarterly/`, and API endpoint `/api/cvm/quarterly/[ticker]`.
>
> **Phase 2 (normalized time-series cache) is implemented.** This includes `src/lib/forecasting/time-series-types.ts`, `src/lib/forecasting/time-series-builder.ts`, `src/lib/forecasting/time-series-cache.ts`, precomputed time-series cache at `src/data/forecast-cache/time-series/`, precompute script `scripts/precompute-time-series-cache.ts` (`npm run time-series:precompute`), and read-only API endpoint `/api/forecasting/time-series/[ticker]`. The cache contains 15 per-metric time series (raw CVM metrics + derived margins and YoY growth rates) with quality metadata.
>
> **Phase 3 (baseline forecast models) is implemented.** This includes `src/lib/forecasting/forecast-types.ts`, `src/lib/forecasting/period-utils.ts`, `src/lib/forecasting/baseline-models.ts` (naive, seasonal_naive, moving_average_4q, linear_trend), `src/lib/forecasting/backtest.ts` (walk-forward backtesting, model selection), `src/lib/forecasting/baseline-forecast-builder.ts`, `src/lib/forecasting/baseline-forecast-cache.ts`, precomputed baseline forecast cache at `src/data/forecast-cache/baseline-forecasts/`, precompute script `scripts/precompute-baseline-forecasts.ts` (`npm run forecast:precompute:baseline`), and read-only API endpoint `/api/forecasting/baseline/[ticker]`. Forecasts cover 8 financial metrics with heuristic uncertainty bands and walk-forward backtest metrics. No dashboard UI changes; no stock prices; no valuation outputs.
>
> **Phase 4 (ForecastPanel UI) is implemented.** This includes `src/components/dashboard/ForecastPanel.tsx`, `src/lib/forecasting/forecast-ui-utils.ts`, and integration into `DashboardPageClient.tsx` as a new "Projeções" tab. The panel fetches `/api/forecasting/baseline/[ticker]` and `/api/forecasting/time-series/[ticker]`, shows a metric selector, SVG line chart with historical + forecast + uncertainty band, a forecast table, and a backtest summary. No forecasting is computed in the dashboard request. No valuation, price target, DCF, or recommendation language is present.
>
> **Phase 5 (Forecast quality diagnostics) is implemented.** This includes `src/lib/forecasting/forecast-quality.ts` with `computeForecastQuality()`, new types `ForecastReliabilityLevel` and `ForecastQualityDiagnostic` in `forecast-types.ts`, and `hasNegativeValues`/`hasLargeOutliers` fields in `MetricForecastResult`. Quality is precomputed and embedded in the baseline forecast cache. The ForecastPanel shows a compact quality card with reliability level (Alta/Média/Baixa/Insuficiente), score (0–100), reasons (Portuguese), and warnings. This is a diagnostic/explainability layer only — no recommendations, price targets, or valuation language.
>
> ARIMA/SARIMA, Prophet, TimesFM, and statistical models are future work.

---

## Table of Contents

1. [Product Framing](#1-product-framing)
2. [Data Requirements](#2-data-requirements)
3. [Architecture](#3-architecture)
4. [Proposed Folder Structure](#4-proposed-folder-structure)
5. [Forecast Cache Schema](#5-forecast-cache-schema)
6. [Model Strategy](#6-model-strategy)
7. [TimesFM Strategy](#7-timesfm-strategy)
8. [Metric Predictability](#8-metric-predictability)
9. [Evaluation Framework](#9-evaluation-framework)
10. [Frontend UX Concept](#10-frontend-ux-concept)
11. [API Strategy](#11-api-strategy)
12. [Cache Strategy](#12-cache-strategy)
13. [Testing Strategy](#13-testing-strategy)
14. [Risks and Limitations](#14-risks-and-limitations)
15. [Implementation Roadmap](#15-implementation-roadmap)

---

## 1. Product Framing

### 1.1 Where the Forecast Layer fits

The current Fundamental Copilot BR pipeline produces historical analysis:

```
CVM DFP annual data
  → normalized financials (NormalizedFinancials[])
  → fundamental indicators
  → rule-based diagnosis
  → dashboard
```

The Forecast Layer adds a forward-looking quantitative branch that runs entirely offline:

```
CVM DFP annual data  ─────────────────────────────────────────────────────┐
CVM ITR quarterly data                                                     │
  → normalized financials                                                  │
  → fundamental indicators → rule-based diagnosis → dashboard              │
  → [Forecast Layer]                                                        │
       time-series normalization                                            │
       → model runner (naive, statistical, foundation)                     │
       → backtesting & model selection                                     │
       → forecast cache (JSON)                                             │
            → Next.js read-only API → dashboard ForecastPanel             │
                                                                           │
  Uncertainty bands and model quality are always surfaced to the user ─────┘
```

The two branches — historical and forecast — are additive: the Forecast Layer never replaces or blocks the existing fundamental dashboard.

### 1.2 What the Forecast Layer forecasts

The Forecast Layer projects **business fundamentals**, not stock prices.

| Forecast targets | Examples |
|---|---|
| Receita líquida | Absolute BRL, quarterly and annual |
| EBIT / EBITDA | Absolute BRL |
| Lucro líquido | Absolute BRL |
| Margens (EBIT, EBITDA, líquida) | Derived from forecasted components |
| Fluxo de caixa operacional | Absolute BRL |
| Capex | Absolute BRL |
| Free cash flow | Derived: FCO − Capex |
| Crescimento de receita | YoY %, derived from forecasted revenue |
| ROIC | Derived when invested capital can be estimated |

The Forecast Layer **does not** produce:

- Stock price forecasts
- Fair value or intrinsic value estimates
- Upside / downside percentages
- Price targets
- Buy / sell / hold recommendations

### 1.3 Design principles

**Forecasts are quantitative estimates, not investment advice.**  
Every surface that exposes forecast data must carry a plain-language disclaimer. The system must never suggest that projected fundamentals imply an investment action.

**Uncertainty must be visible.**  
Every forecast point is accompanied by a confidence interval. Interval width grows with horizon. The dashboard must not display a single point estimate without its band.

**Benchmarks are mandatory.**  
A model is only considered better than the baseline if it demonstrably outperforms a naive or seasonal-naive benchmark in walk-forward backtesting. If it does not, the simpler model is served.

**Forecasts support analysis; they do not replace judgment.**  
Historical fundamentals, sector knowledge, qualitative assessment and risk factors that are invisible to a time-series model (regulatory change, M&A, commodity shock, management change) are beyond the Forecast Layer's scope. The UI must make this explicit.

**Offline precomputation only.**  
No Python model runs during a dashboard request. Forecasts are precomputed, stored, versioned and served from cache. This is the same pattern as the existing CVM precomputed cache.

---

## 2. Data Requirements

### 2.1 Current state and gaps

The existing pipeline uses CVM DFP annual data, normalized to roughly 3–10 observations per company. Annual data is sufficient for historical analysis but marginal for robust time-series forecasting. Eight observations of annual revenue, for example, gives a model very little signal about seasonality, trends within years, or cyclical turning points.

The Forecast Layer requires richer input:

| Input | Status | Notes |
|---|---|---|
| CVM DFP annual data | Available (cached) | Used today; continues as anchor |
| CVM ITR quarterly data | Not yet integrated | Priority data source for the Forecast Layer |
| Restated statement handling | Partial | Restatements from later ITRs must overwrite earlier ones |
| Consistent line-item normalization | Partial | Must be extended for quarterly cadence |
| Company metadata and sector | Available | `b3-universe.ts` |
| Macro covariates (IPCA, Selic, BRL/USD, commodity indices) | Not yet integrated | Phase 4+ feature |

### 2.2 Annual vs. quarterly frequency

**Annual** data is easier to normalize and less affected by seasonal noise, but provides too few observations for most statistical models. A company with 8 years of DFP history gives 8 data points — insufficient for ARIMA or most ML models.

**Quarterly** ITR data multiplies the effective observation count by four. A company with 8 years of quarterly filings gives ~32 observations, which is workable for seasonal models and more informative for foundation models. Quarterly data also exposes seasonality, which is material for retail, agribusiness and commodity sectors.

The Forecast Layer should operate on **quarterly frequency as the primary granularity**, with annual aggregates derived from quarterly forecasts for summary displays.

### 2.3 Minimum observations

| Model class | Recommended minimum observations |
|---|---|
| Naive / seasonal naive | 4 (one full cycle) |
| Moving average | 8 |
| CAGR / linear trend | 4 |
| ARIMA / SARIMA | 24–32 (6–8 years quarterly) |
| Prophet | 16+ with seasonal component |
| TimesFM (zero-shot) | Any (the model carries its own priors) |
| XGBoost with lags | 40+ to avoid severe overfitting |

Companies with fewer than 8 quarterly observations should receive only naive baseline forecasts and a prominent warning about data sparsity.

### 2.4 Data quality concerns

**Restatements.** Brazilian listed companies frequently restate quarterly and annual figures. The ITR pipeline must process filing dates and always prefer the most recently filed version of each period. A naïve time-series that uses preliminary figures will embed restatement noise into forecasts.

**Non-recurring items.** Single-period write-downs, asset disposals, extraordinary provisions and accounting reclassifications can distort revenue and earnings. The normalization layer should flag periods with known extraordinary items. Models trained on non-normalized series will assign structural meaning to transitory distortions.

**Missing data.** ITR filings can be missing, late or structurally incomplete for certain companies (especially smaller ones that do not file consolidated statements). The pipeline must tolerate gaps and document their presence in the cache metadata.

**Outliers.** Extreme values — whether legitimate (a large contract, a commodity spike) or data artifacts — can dominate trend estimation. The normalization layer should apply mild outlier detection (e.g., IQR-based flagging) without automatically removing values, leaving the decision to the model or analyst.

**M&A and accounting perimeter changes.** Acquisitions, spin-offs and reclassifications create structural breaks. A jump from BRL 2 B to BRL 8 B revenue after an acquisition is not a trend — it is a new starting point. The system should detect and annotate structural breaks. Models trained across structural breaks will produce biased forecasts unless the break is modelled explicitly.

**Sector-specific adjustments.** Banks, insurers, FIIs and ETFs use different line items (NII, PDD, P&L provisions, DY, NAV) that map poorly onto the industrial normalization scheme. The Forecast Layer must not attempt to forecast revenue or EBIT for these asset types using industrial models. Sector-specific methodologies are a Phase 10 concern; until then, sector-specific assets should be excluded from forecast generation.

**Inflation and currency.** Brazilian nominal financials grow partly due to inflation. Depending on the metric, it may be more predictable in real terms or in USD. The pipeline should document nominal vs. real treatment and be prepared to deflate inputs for certain model configurations.

---

## 3. Architecture

### 3.1 Core principle: offline precomputation

Python forecasting models must not execute during dashboard requests. This is non-negotiable for three reasons:

1. **Latency.** Statistical and foundation models (ARIMA, Prophet, TimesFM) require seconds to minutes of computation. A dashboard endpoint must respond in milliseconds.
2. **Dependency isolation.** Running Python inside Vercel serverless functions is impractical and would introduce heavy model weights into the deployment bundle.
3. **Reproducibility and auditability.** Precomputed forecasts can be versioned, reviewed, diffed and re-generated with the exact same inputs. On-demand forecasts are difficult to audit.

The pattern mirrors the existing precomputed CVM cache: a CLI script generates JSON files offline; the Next.js API reads and serves them.

### 3.2 Full pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│  CVM DFP annual ZIPs  +  CVM ITR quarterly ZIPs                 │
│  (dados.cvm.gov.br — downloaded offline)                        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  data_loader.py                                                  │
│  Parses raw CVM archives, resolves restatements, aligns         │
│  quarterly and annual reporting periods.                        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  normalizer.py + series_builder.py                              │
│  Maps CVM accounts to canonical metrics.                        │
│  Detects structural breaks, flags outliers, annotates gaps.     │
│  Produces ForecastInputSeries per ticker per metric.            │
└────────────────────────┬────────────────────────────────────────┘
                         │
                    ┌────┴──────┐
                    │           │
                    ▼           ▼
           ┌──────────────┐  ┌──────────────────────────────────┐
           │ model_runner │  │  evaluation/backtest.py           │
           │  naive       │  │  Walk-forward cross-validation    │
           │  seasonal    │  │  across all models and horizons   │
           │  moving_avg  │  └──────────────┬───────────────────┘
           │  cagr        │                 │
           │  arima       │                 ▼
           │  prophet     │  ┌──────────────────────────────────┐
           │  timesfm     │  │  model_selection.py               │
           └──────┬───────┘  │  Selects best model per metric   │
                  │          │  per horizon vs. naive benchmark  │
                  └────┬─────┘
                       │
                       ▼
          ┌────────────────────────────┐
          │  output/writer.py          │
          │  Writes <TICKER>.json to   │
          │  src/data/forecast-cache/  │
          └────────────┬───────────────┘
                       │
                       ▼
          ┌────────────────────────────┐
          │  Next.js                   │
          │  /api/forecasts/[ticker]   │
          │  Reads JSON, returns it    │
          │  (no Python, no model)     │
          └────────────┬───────────────┘
                       │
                       ▼
          ┌────────────────────────────┐
          │  ForecastPanel (dashboard) │
          │  ForecastChart             │
          │  ForecastQualityBadge      │
          └────────────────────────────┘
```

### 3.3 Trigger and scheduling

The precompute script (`precompute-forecasts.py`) runs as a manual or scheduled CLI command, not as part of the Next.js build. It should be re-runnable at any time. The generated JSON files are committed (if small) or stored in object storage (if large), and the Next.js API reads them as static assets.

---

## 4. Proposed Folder Structure

The following structure is **proposed for future implementation**. No files from this structure exist today.

```
forecasting/                        ← standalone Python package (future)
  pyproject.toml
  README.md
  src/
    fundamental_forecast/
      __init__.py
      config.py                     ← model parameters, ticker list, horizons
      data_loader.py                ← CVM DFP + ITR parsing, restatement logic
      normalizer.py                 ← account-to-metric mapping for time series
      series_builder.py             ← ForecastInputSeries construction, gap/outlier flags
      models/
        __init__.py
        base.py                     ← abstract ForecastModel interface
        naive.py                    ← last-value naive
        seasonal_naive.py           ← same quarter last year
        moving_average.py           ← configurable window
        cagr.py                     ← compound annual growth rate extrapolation
        arima.py                    ← ARIMA / SARIMA wrapper (statsmodels)
        prophet_model.py            ← Prophet wrapper (prophet)
        timesfm_model.py            ← TimesFM wrapper (timesfm)
      evaluation/
        backtest.py                 ← walk-forward validation engine
        metrics.py                  ← MAPE, sMAPE, WAPE, RMSE, MASE, dir. accuracy
        model_selection.py          ← selects best model; falls back to benchmark
      output/
        schema.py                   ← ForecastCache dataclass / Pydantic model
        writer.py                   ← serializes ForecastCache to JSON
  tests/
    test_normalizer.py
    test_series_builder.py
    test_naive.py
    test_seasonal_naive.py
    test_arima.py
    test_metrics.py
    test_backtest.py
    test_writer.py
    test_schema_validation.py

scripts/
  precompute-forecasts.py           ← CLI entry point; reads config, runs pipeline

src/
  lib/
    forecasts/
      types.ts                      ← TypeScript types mirroring the JSON schema
      forecast-cache.ts             ← reads JSON from src/data/forecast-cache/
      forecast-normalizer.ts        ← unit conversion helpers (BRL billions, %)
  app/
    api/
      forecasts/
        [ticker]/
          route.ts                  ← read-only endpoint; returns cached JSON or 404
  components/
    dashboard/
      ForecastPanel.tsx             ← container; handles available/unavailable state
      ForecastChart.tsx             ← SVG chart with forecast line + uncertainty band
      ForecastQualityBadge.tsx      ← MAPE badge + model name
      ModelComparison.tsx           ← model vs. benchmark metric table
      ForecastWarnings.tsx          ← renders warnings[] from cache
      ForecastScenarioSummary.tsx   ← summary of key projected values
  data/
    forecast-cache/                 ← precomputed JSON (generated, not hand-authored)
      KLBN11.json
      PETR4.json
      VALE3.json
      WEGE3.json
      ...
```

---

## 5. Forecast Cache Schema

Each file in `src/data/forecast-cache/` follows this schema. TypeScript types and a Python Pydantic model should both be derived from this specification.

### 5.1 JSON shape

```json
{
  "ticker": "KLBN11",
  "companyName": "Klabin S.A.",
  "source": "forecast_layer",
  "schemaVersion": "1.0.0",
  "generatedAt": "2026-05-10T00:00:00.000Z",
  "inputData": {
    "source": "CVM DFP + ITR",
    "frequency": "quarterly",
    "lastObservedPeriod": "2025Q4",
    "observations": 28,
    "structuralBreaks": [],
    "outlierPeriods": ["2020Q2"],
    "missingPeriods": []
  },
  "forecasts": [
    {
      "metric": "revenue",
      "label": "Receita líquida",
      "unit": "BRL_BILLION",
      "frequency": "quarterly",
      "modelSelected": "seasonal_naive",
      "benchmark": "seasonal_naive",
      "horizon": 8,
      "quality": {
        "backtestMAPE": 8.7,
        "backtestMASE": 0.82,
        "backtestDirectionalAccuracy": 0.71,
        "backtestCoverageAt80": 0.79,
        "benchmarkMAPE": 11.4,
        "benchmarkMASE": 1.0,
        "evaluationHorizonQuarters": 4,
        "evaluationFolds": 6
      },
      "modelComparison": [
        { "model": "seasonal_naive",   "MAPE": 8.7,  "MASE": 0.82, "selected": true  },
        { "model": "naive",            "MAPE": 13.1", "MASE": 1.24, "selected": false },
        { "model": "cagr",             "MAPE": 10.2", "MASE": 0.96, "selected": false }
      ],
      "points": [
        { "period": "2026Q1", "yhat": 5.12, "yhatLower": 4.71, "yhatUpper": 5.58 },
        { "period": "2026Q2", "yhat": 5.34, "yhatLower": 4.80, "yhatUpper": 5.93 },
        { "period": "2026Q3", "yhat": 5.28, "yhatLower": 4.62, "yhatUpper": 6.01 },
        { "period": "2026Q4", "yhat": 5.61, "yhatLower": 4.83, "yhatUpper": 6.52 },
        { "period": "2027Q1", "yhat": 5.48, "yhatLower": 4.57, "yhatUpper": 6.58 },
        { "period": "2027Q2", "yhat": 5.72, "yhatLower": 4.70, "yhatUpper": 6.96 },
        { "period": "2027Q3", "yhat": 5.65, "yhatLower": 4.58, "yhatUpper": 6.97 },
        { "period": "2027Q4", "yhat": 6.01, "yhatLower": 4.79, "yhatUpper": 7.54 }
      ]
    },
    {
      "metric": "ebit",
      "label": "EBIT",
      "unit": "BRL_BILLION",
      "frequency": "quarterly",
      "modelSelected": "moving_average",
      "benchmark": "seasonal_naive",
      "horizon": 8,
      "quality": {
        "backtestMAPE": 14.2,
        "backtestMASE": 1.08,
        "backtestDirectionalAccuracy": 0.62,
        "backtestCoverageAt80": 0.75,
        "benchmarkMAPE": 16.1,
        "benchmarkMASE": 1.0,
        "evaluationHorizonQuarters": 4,
        "evaluationFolds": 6
      },
      "modelComparison": [
        { "model": "moving_average",  "MAPE": 14.2, "MASE": 1.08, "selected": true  },
        { "model": "seasonal_naive",  "MAPE": 16.1, "MASE": 1.0,  "selected": false },
        { "model": "cagr",            "MAPE": 18.7, "MASE": 1.16, "selected": false }
      ],
      "points": [
        { "period": "2026Q1", "yhat": 1.21, "yhatLower": 0.94, "yhatUpper": 1.55 }
      ]
    }
  ],
  "warnings": [
    "Projeções quantitativas baseadas em dados históricos da companhia. Não constituem recomendação de investimento.",
    "O período 2020Q2 foi identificado como outlier (impacto COVID-19) e recebeu tratamento especial na série de entrada.",
    "Horizonte de 8 trimestres apresenta maior incerteza; bandas de confiança ampliam-se com o horizonte."
  ]
}
```

### 5.2 TypeScript interface sketch

The following is an interface sketch intended to guide future implementation. It is not active code.

```typescript
// src/lib/forecasts/types.ts  (future file — not yet created)

export type ForecastUnit = "BRL_BILLION" | "BRL_MILLION" | "PERCENT" | "RATIO";
export type ForecastFrequency = "quarterly" | "annual";
export type ForecastMetric =
  | "revenue"
  | "ebit"
  | "ebitda"
  | "netIncome"
  | "ebitMargin"
  | "ebitdaMargin"
  | "operatingCashFlow"
  | "capex"
  | "freeCashFlow"
  | "revenueGrowthYoy"
  | "roic";

export interface ForecastPoint {
  period:     string;   // "2026Q1" or "2026"
  yhat:       number;
  yhatLower:  number;
  yhatUpper:  number;
}

export interface ModelComparisonRow {
  model:    string;
  MAPE:     number;
  MASE:     number;
  selected: boolean;
}

export interface ForecastQuality {
  backtestMAPE:                 number;
  backtestMASE:                 number;
  backtestDirectionalAccuracy:  number;
  backtestCoverageAt80:         number;
  benchmarkMAPE:                number;
  benchmarkMASE:                number;
  evaluationHorizonQuarters:    number;
  evaluationFolds:              number;
}

export interface MetricForecast {
  metric:         ForecastMetric;
  label:          string;
  unit:           ForecastUnit;
  frequency:      ForecastFrequency;
  modelSelected:  string;
  benchmark:      string;
  horizon:        number;
  quality:        ForecastQuality;
  modelComparison: ModelComparisonRow[];
  points:         ForecastPoint[];
}

export interface ForecastInputData {
  source:              string;
  frequency:           ForecastFrequency;
  lastObservedPeriod:  string;
  observations:        number;
  structuralBreaks:    string[];
  outlierPeriods:      string[];
  missingPeriods:      string[];
}

export interface ForecastCache {
  ticker:        string;
  companyName:   string;
  source:        "forecast_layer";
  schemaVersion: string;
  generatedAt:   string;  // ISO 8601
  inputData:     ForecastInputData;
  forecasts:     MetricForecast[];
  warnings:      string[];
}
```

### 5.3 Python schema sketch (Pydantic)

```python
# forecasting/src/fundamental_forecast/output/schema.py  (future file — not yet created)

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Literal

ForecastUnit      = Literal["BRL_BILLION", "BRL_MILLION", "PERCENT", "RATIO"]
ForecastFrequency = Literal["quarterly", "annual"]

@dataclass
class ForecastPoint:
    period:    str
    yhat:      float
    yhat_lower: float
    yhat_upper: float

@dataclass
class ModelComparisonRow:
    model:    str
    MAPE:     float
    MASE:     float
    selected: bool

@dataclass
class ForecastQuality:
    backtest_mape:                  float
    backtest_mase:                  float
    backtest_directional_accuracy:  float
    backtest_coverage_at_80:        float
    benchmark_mape:                 float
    benchmark_mase:                 float
    evaluation_horizon_quarters:    int
    evaluation_folds:               int

@dataclass
class MetricForecast:
    metric:           str
    label:            str
    unit:             ForecastUnit
    frequency:        ForecastFrequency
    model_selected:   str
    benchmark:        str
    horizon:          int
    quality:          ForecastQuality
    model_comparison: list[ModelComparisonRow]
    points:           list[ForecastPoint]

@dataclass
class ForecastInputData:
    source:               str
    frequency:            ForecastFrequency
    last_observed_period: str
    observations:         int
    structural_breaks:    list[str] = field(default_factory=list)
    outlier_periods:      list[str] = field(default_factory=list)
    missing_periods:      list[str] = field(default_factory=list)

@dataclass
class ForecastCache:
    ticker:         str
    company_name:   str
    source:         Literal["forecast_layer"]
    schema_version: str
    generated_at:   str   # ISO 8601
    input_data:     ForecastInputData
    forecasts:      list[MetricForecast]
    warnings:       list[str]
```

---

## 6. Model Strategy

The model strategy is phased to ensure that complexity is introduced only when it is validated by backtesting. Every phase must beat the previous phase's best model on held-out data before it is promoted.

### 6.1 Phase 1 — Baselines (always present)

These models require minimal data, run instantly and provide the benchmark that all other models must beat.

| Model | Description |
|---|---|
| **Naive** | Forecast = last observed value. Assumes no change. |
| **Seasonal naive** | Forecast = same period last year (or last cycle). Captures seasonality without trend. |
| **Moving average** | Unweighted or exponentially weighted average of recent periods. |
| **CAGR extrapolation** | Fits a compound growth rate over the available history and projects forward. Simple but interpretable. |

Seasonal naive is the primary benchmark against which all other models are evaluated. If CAGR, ARIMA or TimesFM cannot beat seasonal naive in backtesting, seasonal naive is served.

### 6.2 Phase 2 — Statistical models

| Model | Description | Dependency |
|---|---|---|
| **ARIMA / SARIMA** | Autoregressive integrated moving average with seasonal extension. Appropriate when stationarity can be established. | `statsmodels` |
| **ETS** | Exponential smoothing with error, trend, seasonality decomposition. Simple and interpretable. | `statsmodels` |
| **Prophet** | Additive regression model with flexible trend, seasonality and holiday effects. Works well with irregular gaps and Brazilian macro events. | `prophet` |

These models are not added until quarterly ITR data exists and the backtesting framework is in place.

### 6.3 Phase 3 — Foundation model

| Model | Description | Dependency |
|---|---|---|
| **TimesFM** | Google's pre-trained foundation model for time-series forecasting. Zero-shot capable; no per-company training required. | `timesfm` |

TimesFM is a candidate model, not a guaranteed improvement. See Section 7 for the full TimesFM strategy.

### 6.4 Phase 4 — ML with covariates

| Model | Description | Dependency |
|---|---|---|
| **XGBoost / LightGBM** | Gradient boosted trees with lagged fundamental features, sector dummies, macro covariates. Requires substantially more data than baseline models. | `xgboost`, `lightgbm` |

Feature set candidates: lagged revenue, lagged margins, sector encoding, IPCA, Selic rate, BRL/USD, iron ore price (for miners), pulp price (for paper/cellulose), retail sales index (for retailers).

ML models introduce overfitting risk on short company-level series. They are appropriate only after Phase 1–3 validation confirms that more data is available and that the ML features are empirically justified.

### 6.5 Model selection rule

For each metric and each horizon, the system selects the model with the lowest backtesting MAPE that also satisfies:

- MASE ≤ 1.0 relative to seasonal naive (i.e., not worse than the benchmark)
- Interval coverage at 80% ≥ 0.70

If no advanced model meets both conditions, seasonal naive (or naive for non-seasonal metrics) is selected. The selected model and its backtest metrics are stored in the forecast cache.

---

## 7. TimesFM Strategy

TimesFM (Google, 2024) is a pre-trained foundation model for zero-shot time-series forecasting. It can generate forecasts without company-specific fine-tuning, making it attractive for a platform that covers ~50+ companies with sparse histories.

### 7.1 Pre-conditions before TimesFM integration

TimesFM must not be integrated before all of the following are true:

1. **Quarterly ITR data pipeline exists.** TimesFM performs best with at least 16–32 observations. Annual-only data (8–10 points) may not provide sufficient signal.
2. **Normalized time-series cache exists.** The `series_builder.py` module must produce clean, consistent input series before any model can be applied.
3. **Backtesting framework exists.** Without walk-forward validation, there is no way to know whether TimesFM adds value over seasonal naive.
4. **Forecast JSON schema is stable.** Model outputs must conform to a fixed schema; changing the schema after TimesFM is integrated creates migration work.
5. **Model comparison logic exists.** TimesFM must be evaluated alongside naive, seasonal naive and CAGR in the same backtesting framework before it can be presented to users.

### 7.2 Positioning

- TimesFM is a **candidate model** evaluated against simpler baselines. It is not assumed to win.
- TimesFM is a **zero-shot forecaster**. No fine-tuning or training data beyond the input series is required.
- TimesFM is **not a stock price prediction model**. It receives accounting time-series (revenue, EBIT) as input and outputs projected accounting time-series. The dashboard must not frame TimesFM outputs as market predictions.
- TimesFM runs **offline in the precompute pipeline only**. It is never invoked during a dashboard request.

### 7.3 Expected performance characteristics

TimesFM was trained primarily on financial time-series from global markets. Brazilian company fundamentals may differ in:

- Nominal BRL values subject to high inflation
- Short history relative to the training distribution
- Structural breaks from M&A, privatizations, commodity shocks
- High volatility in some sectors (mining, oil & gas)

It is plausible that TimesFM underperforms seasonal naive for many Brazilian company fundamentals. The backtesting framework will make this empirically measurable. If TimesFM does not beat seasonal naive in MASE for a given metric, it is not selected and is not presented as superior in the cache or the dashboard.

### 7.4 Computational requirements

TimesFM requires GPU or MPS acceleration for reasonable throughput when processing many companies. The precompute script should be designed to run on a local machine with GPU, a cloud GPU instance or a CI runner with hardware acceleration. CPU-only inference is possible but slow.

The model weights (~200 MB for the base checkpoint) must not be committed to the repository. The precompute script should download them on demand or from a configured path.

---

## 8. Metric Predictability

Not all financial metrics are equally predictable. Understanding this ranking guides which metrics to forecast first and which require more data or more sophisticated models.

### 8.1 Generally more predictable

| Metric | Reason |
|---|---|
| **Revenue (Receita líquida)** | For stable companies, revenue is the most predictable fundamental. It is driven by volume × price, both of which tend to show inertia. Seasonal patterns are strong in retail and agribusiness. |
| **Gross profit** | Strongly correlated with revenue; gross margin tends to be sticky for established businesses. |
| **EBIT / EBITDA (stable companies)** | Predictable when operating leverage is stable. Harder for commodity exporters. |
| **EBIT and EBITDA margins** | Mature companies with stable competitive positions show mean-reverting margins. Best derived from forecasted EBIT / revenue, not forecast directly. |

### 8.2 Moderately predictable

| Metric | Reason |
|---|---|
| **Net income (Lucro líquido)** | Revenue and EBIT are more predictable; below the EBIT line, financial expenses, tax rates and non-recurring items add noise. |
| **Operating cash flow (CFO)** | Correlated with EBITDA but affected by working capital movements, which can be volatile. |
| **Free cash flow (FCL)** | Derived from CFO − Capex. Both are moderately predictable in isolation; their difference amplifies uncertainty. |

### 8.3 Harder to predict

| Metric | Reason |
|---|---|
| **Capex** | Can be lumpy, driven by investment cycles, strategic decisions and asset life. Not well-suited to naive extrapolation. |
| **Net income for cyclical companies** | For commodity-exposed companies (Vale, Petrobras, Klabin, Suzano), net income is heavily driven by commodity prices, FX and hedge positions — all outside the model's input set. |
| **FCL for investment-heavy companies** | Heavy capex cycles can invert FCL sign year over year, making trend extrapolation misleading. |
| **ROIC** | Depends on both return (NOPAT) and invested capital (which changes with M&A, capex and working capital). Best derived from forecasted components rather than forecasted directly. |

### 8.4 Recommended derivation order

1. Forecast absolute accounting lines: revenue, EBIT, EBITDA, CFO, capex.
2. Derive margins and growth rates from forecasted components: EBIT margin = EBIT / revenue; revenue growth = (revenue_t − revenue_{t-4}) / revenue_{t-4}.
3. Derive FCL = forecasted CFO − forecasted capex.
4. Derive ROIC only when invested capital can be estimated from balance sheet forecasts (a Phase 4+ capability).

Avoid forecasting ratios directly unless empirical backtesting shows they are more predictable than their components.

---

## 9. Evaluation Framework

### 9.1 Walk-forward validation

All model evaluation uses walk-forward (rolling origin) cross-validation. For a company with T quarterly observations:

- Each fold trains on observations 1..k and evaluates on observations k+1..k+h.
- k increases by one period per fold.
- Minimum training size: 12 quarters (3 years).
- Evaluation is repeated for horizons h = 1, 4, 8 quarters.
- Minimum number of evaluation folds: 4 (otherwise the estimate is too noisy to be meaningful).

This is strict out-of-sample evaluation. No information from the evaluation window leaks into model training or parameter estimation.

### 9.2 Evaluation horizons

| Horizon | Periods | Use case |
|---|---|---|
| h = 1 quarter | 3 months | Near-term check; useful for ITR guidance comparison |
| h = 4 quarters | 1 year | Annual projection; most common analyst horizon |
| h = 8 quarters | 2 years | Medium-term planning horizon |

Long-horizon forecasts (h > 8 quarters) are not generated in initial phases. Uncertainty grows rapidly with horizon and forecast utility deteriorates for most business fundamentals beyond 2 years.

### 9.3 Accuracy metrics

| Metric | Formula | Notes |
|---|---|---|
| **MAPE** | mean(|y − ŷ| / |y|) × 100 | Interpretable but unstable near zero |
| **sMAPE** | mean(2|y − ŷ| / (|y| + |ŷ|)) × 100 | Symmetric; better near zero |
| **WAPE** | sum(|y − ŷ|) / sum(|y|) × 100 | Robust to outliers; weighted aggregate |
| **RMSE** | sqrt(mean((y − ŷ)²)) | Scale-dependent; useful for absolute error |
| **MASE** | mean(|y − ŷ|) / mean(|y_t − y_{t−s}|) | Scale-free; < 1.0 means better than seasonal naive |
| **Directional accuracy** | mean(sign(y − y_{t-1}) == sign(ŷ − y_{t-1})) | Whether the model predicts the direction of change correctly |
| **Interval coverage at 80%** | fraction of actuals inside the 80% prediction interval | Should be close to 0.80; calibration check |

**Notes on metric interpretation:**

- MAPE is undefined when the actual is zero and unstable when the actual is small. For metrics that can be near zero (EBIT for loss-making companies), WAPE or MASE is preferred.
- MASE < 1.0 confirms the model outperforms the seasonal naive benchmark. MASE > 1.0 means the model should not be selected over the baseline.
- Directional accuracy is particularly meaningful for fundamental trend analysis. A model that correctly identifies whether revenue is growing or declining, even if the magnitude is imprecise, provides useful information for qualitative judgment.
- Interval coverage should be tracked over time. A model that reports 80% intervals but achieves only 55% empirical coverage is miscalibrated and will mislead users.

### 9.4 Model selection decision tree

```
For each (metric, horizon) pair:

1. Compute MASE for all candidate models.
2. If no candidate achieves MASE < 1.0:
   → Select seasonal naive (or naive for non-seasonal metrics).
   → Set warning: "Modelos alternativos não superaram o benchmark nesta série."
3. Else:
   → Among models with MASE < 1.0, select the one with lowest MAPE.
   → Verify interval coverage at 80% ≥ 0.70.
   → If coverage is below 0.70, flag a calibration warning in the cache.
4. Store the selected model, its metrics and the full comparison table in the cache.
```

---

## 10. Frontend UX Concept

### 10.1 Component overview

The following dashboard components are proposed for future implementation. None are created by this document.

| Component | Responsibility |
|---|---|
| `ForecastPanel` | Container; checks whether forecast cache exists; renders available or unavailable state |
| `ForecastChart` | SVG chart with historical line + forecast line + shaded uncertainty band; horizon line separating observed from projected |
| `ForecastQualityBadge` | Small badge showing selected model name, MAPE and MASE; color-coded by quality tier |
| `ModelComparison` | Expandable table showing all candidate models and their backtest metrics |
| `ForecastWarnings` | Renders the `warnings[]` array from the cache in a visible, accessible format |
| `ForecastScenarioSummary` | Shows a summary of projected values at h = 4 and h = 8 quarters with point estimate and range |

### 10.2 Tab placement

The Forecast Layer should occupy a new tab in the existing `TabBar`, placed after "Indicadores":

```
Visão Geral | Financeiros | Indicadores | Projeções | Comparáveis | Notícias e documentos
```

"Projeções" renders the `ForecastPanel`. If no forecast cache exists for the ticker, `ForecastPanel` shows a clear unavailable state — not an error, not a loading spinner.

### 10.3 Available state

When a forecast cache exists:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Projeções quantitativas — Receita líquida                               │
│                                                                         │
│ Fonte: CVM ITR quarterly · Modelo: Seasonal Naive · MAPE: 8.7%         │
│ Horizonte: 8 trimestres · Último período observado: 2025Q4             │
│                                                                         │
│  [Historical + Forecast SVG chart with uncertainty band]               │
│                                                                         │
│ ▶ Ver qualidade do modelo                                               │
│ ▶ Ver comparação de modelos                                             │
│                                                                         │
│ ⚠ As projeções abaixo são estimativas quantitativas baseadas em dados  │
│   históricos da companhia. Elas não representam recomendação de         │
│   investimento.                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 10.4 Unavailable state

When no forecast cache exists for the ticker:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  📊  Projeções não disponíveis                                          │
│                                                                         │
│  A camada de projeções quantitativas ainda não foi gerada para          │
│  este ativo. O dashboard fundamentalista histórico permanece            │
│  disponível nas outras abas.                                            │
└─────────────────────────────────────────────────────────────────────────┘
```

This state must never block or delay the fundamental dashboard. It renders immediately with no network request.

### 10.5 User-facing copy rules

- Always lead with the disclaimer: "As projeções abaixo são estimativas quantitativas baseadas em dados históricos da companhia. Elas não representam recomendação de investimento."
- Always show the model name and MAPE so users can assess quality.
- Always show the last observed period so users know where history ends and projection begins.
- Never use language that implies certainty: "a receita será", "projetamos", "estimamos". Use "projeção quantitativa", "estimativa baseada em histórico".
- Never use language associated with investment recommendations: "compra", "venda", "preço-alvo", "potencial de valorização".

### 10.6 ForecastQualityBadge tiers

| MAPE range | Label | Color |
|---|---|---|
| < 5% | Excelente | Green |
| 5–10% | Boa | Blue |
| 10–20% | Moderada | Amber |
| > 20% | Baixa | Red |
| Model = baseline | Baseline | Grey |

Baseline means the selected model is seasonal naive or naive — no advanced model outperformed the benchmark. This is not an error; it should be displayed honestly.

---

## 11. API Strategy

### 11.1 Endpoint

```
GET /api/forecasts/[ticker]
```

### 11.2 Behavior

| Condition | Response |
|---|---|
| Forecast cache exists for ticker | 200 — returns `ForecastCache` JSON |
| Forecast cache does not exist | 404 — returns `{ available: false, ticker }` |
| Malformed cache file | 500 — returns error with internal logging |

The endpoint **does not**:
- Run any Python
- Call any external service
- Trigger any computation
- Block on CVM or brapi requests

It reads a static JSON file from `src/data/forecast-cache/[ticker].json` and returns it. Response time should be < 5 ms.

### 11.3 Dashboard integration rules

- The dashboard fetches `/api/forecasts/[ticker]` independently of the CVM and market-data fetches.
- A 404 response renders the unavailable state in `ForecastPanel`. The rest of the dashboard is unaffected.
- The forecast fetch must never block the rendering of `CompanyHeader`, `MetricsRow`, `CvmFinancialsTable` or `DocumentsPanel`.
- `ForecastPanel` is only visible when the user navigates to the "Projeções" tab. The fetch should be lazy (triggered on tab activation, not on dashboard mount).

### 11.4 Route sketch

```typescript
// src/app/api/forecasts/[ticker]/route.ts  (future file — not yet created)

import { NextResponse } from "next/server";
import { readForecastCache } from "@/lib/forecasts/forecast-cache";

export async function GET(
  _req: Request,
  { params }: { params: { ticker: string } },
) {
  const ticker = params.ticker.toUpperCase();
  const cache  = await readForecastCache(ticker);

  if (!cache) {
    return NextResponse.json({ available: false, ticker }, { status: 404 });
  }

  return NextResponse.json(cache);
}
```

```typescript
// src/lib/forecasts/forecast-cache.ts  (future file — not yet created)

import fs   from "fs/promises";
import path from "path";
import type { ForecastCache } from "./types";

const CACHE_DIR = path.join(process.cwd(), "src/data/forecast-cache");

export async function readForecastCache(
  ticker: string,
): Promise<ForecastCache | null> {
  try {
    const raw = await fs.readFile(
      path.join(CACHE_DIR, `${ticker}.json`),
      "utf-8",
    );
    return JSON.parse(raw) as ForecastCache;
  } catch {
    return null;
  }
}
```

---

## 12. Cache Strategy

### 12.1 Storage approach

| Artifact | Committed? | Notes |
|---|---|---|
| `src/data/forecast-cache/*.json` | Yes (if small) | Compact JSON; one file per ticker; a full 50-ticker cache at 50 KB per file is ~2.5 MB — acceptable for a git repository |
| Raw CVM ZIPs and CSVs | No | Never committed; downloaded on demand by the precompute script |
| Python model artifacts (fitted models, weights) | No | Intermediate artefacts; only the output JSON is committed |
| TimesFM model weights | No | Downloaded at precompute time from the configured checkpoint path |

If the forecast-cache grows beyond ~10 MB (due to many tickers, many horizons or many models being stored), the cache should be moved to object storage (S3, GCS or similar) and served via a CDN or the API endpoint should stream from there.

### 12.2 Cache metadata for reproducibility

Every cache file includes:

- `generatedAt`: ISO 8601 timestamp of when the precompute ran.
- `schemaVersion`: version string (`"1.0.0"`); a schema change increments this.
- `inputData.lastObservedPeriod`: the last period in the training data; this makes the cache self-documenting.
- `inputData.observations`: number of quarters used for training; allows detection of stale caches (cache was generated with 20 quarters; 4 new quarters are now available).
- `modelSelected` and `quality` metrics per metric forecast: makes the selection decision auditable.

### 12.3 Staleness and refresh policy

A cache file is considered stale when:

- A new quarterly ITR filing has been incorporated into the normalized series.
- The model selection logic has changed.
- A bug in the normalization pipeline has been fixed.

The precompute script should be re-runnable unconditionally. A CI job or a manual developer command regenerates all caches when new CVM data arrives.

```bash
# Proposed future command (not yet added to package.json)
npm run forecasts:precompute
# or directly:
python scripts/precompute-forecasts.py --all
python scripts/precompute-forecasts.py --ticker KLBN11
```

---

## 13. Testing Strategy

### 13.1 Python tests (forecasting package)

| Test file | What is tested |
|---|---|
| `test_normalizer.py` | Account mapping correctness; revenue, EBIT, FCL extraction from raw DFP/ITR rows |
| `test_series_builder.py` | Series construction from normalized financials; gap detection; outlier flagging; structural break annotation |
| `test_naive.py` | Naive and seasonal naive output correctness for simple fixed inputs |
| `test_moving_average.py` | MA output with various window sizes; edge cases (fewer periods than window) |
| `test_cagr.py` | CAGR extrapolation with known growth rates; negative/zero revenue handling |
| `test_arima.py` | ARIMA wrapper returns forecasts with correct shape; does not raise on short series |
| `test_metrics.py` | MAPE, sMAPE, WAPE, RMSE, MASE, directional accuracy against known inputs |
| `test_backtest.py` | Walk-forward validation produces correct fold structure; no data leakage |
| `test_model_selection.py` | Correct model is selected given mock backtest results; falls back to seasonal naive when no model beats benchmark |
| `test_writer.py` | Output JSON conforms to schema; `generatedAt` is a valid ISO 8601 timestamp |
| `test_schema_validation.py` | All example JSON files in `src/data/forecast-cache/` validate against the Pydantic schema |

### 13.2 TypeScript tests

| Test file | What is tested |
|---|---|
| `forecast-cache.test.ts` | `readForecastCache` returns `ForecastCache` for existing file; returns `null` for missing file |
| `forecast-normalizer.test.ts` | BRL billion formatting; percentage formatting; zero and negative value handling |
| `types.test.ts` (schema check) | Parsed JSON from example cache files matches `ForecastCache` TypeScript shape |

### 13.3 Frontend tests

| Test | What is tested |
|---|---|
| `ForecastPanel — available state` | Renders `ForecastChart`, `ForecastQualityBadge` and `ForecastWarnings` when cache data is provided |
| `ForecastPanel — unavailable state` | Renders unavailable message when API returns 404; does not block other dashboard sections |
| `ForecastQualityBadge — tier labels` | Correct label and color for each MAPE range |
| `ForecastWarnings — disclaimer` | Disclaimer text is always rendered when warnings array is non-empty |

### 13.4 Snapshot and contract tests

- Committed example cache files (e.g., `src/data/forecast-cache/KLBN11.json`) should be validated against the `ForecastCache` schema in CI. A schema change that breaks an existing file must be caught before merge.
- The API route handler should have an integration test that reads a test fixture file and returns the correct shape.

---

## 14. Risks and Limitations

### 14.1 Data-related risks

**Short time series.** Most Brazilian companies have reliable DFP history from ~2010. That is 15 years of annual data (15 points) or ~60 quarters. For companies that listed more recently, IPO'd, or changed their reporting perimeter, usable history may be far shorter. Forecasting models trained on fewer than 12 quarters are unreliable.

**Annual data sparsity.** Annual-only data (the current state) gives 10–15 observations per company. This is insufficient for ARIMA or TimesFM and barely sufficient for seasonal naive. Quarterly ITR data is a pre-condition for meaningful statistical forecasting.

**Quarterly data quality.** Brazilian ITR filings have historically been less audited and more prone to restatement than annual DFPs. The normalization pipeline must handle restated figures carefully.

**Non-recurring items.** Write-downs, asset sales, M&A costs and regulatory provisions create large one-period distortions that models interpret as structural features. Without explicit annotation, these distortions bias forecasts.

**Restatements.** A period that is restated by a subsequent filing may show a value materially different from the originally filed value. The pipeline must always use the most recently filed version.

### 14.2 Model-related risks

**Overfitting on short series.** Complex models (ARIMA with many parameters, XGBoost with many features) trained on 20–30 observations will overfit. Walk-forward validation with strict out-of-sample evaluation is the primary safeguard.

**False precision.** Point estimates (e.g., "Revenue 2026Q3: R$ 5.12 B") imply precision that the model does not have. The system must always display uncertainty intervals and explicitly warn that the intervals represent model-based uncertainty, not all sources of business risk.

**Distribution shift.** Models trained on pre-2020 data were calibrated in a different macroeconomic environment (pre-pandemic, pre-Selic cycle). Structural regime changes can invalidate historically estimated parameters.

**Benchmark arrogance.** There is a persistent tendency to assume that sophisticated models (TimesFM, Prophet) will outperform simple baselines. For short financial time series with complex business dynamics, seasonal naive frequently wins. The evaluation framework must enforce honest comparison.

### 14.3 Sector-specific risks

**Banks, insurers and financial holdings.** Revenue and profit metrics for banks (NII, credit provisions) are structurally different from industrial companies. The Forecast Layer must not apply industrial forecasting models to these entities.

**FIIs and ETFs.** FII distributions (DY) and ETF NAV are driven by portfolio composition, not by revenue/EBIT dynamics. Fundamental forecasting models do not apply.

**Commodity-exposed companies.** For Vale (iron ore), Petrobras (Brent), Suzano and Klabin (pulp), earnings are heavily driven by commodity price movements that are outside the model's feature set. Fundamental forecasts for these companies have higher irreducible uncertainty.

**M&A and accounting perimeter changes.** An acquisition that doubles revenue in a single quarter creates a structural break. A model trained through that break will extrapolate an artificial growth rate. The pipeline must detect and annotate these events.

**Inflation and currency effects.** Brazilian nominal financials grow partly due to BRL depreciation and IPCA inflation. A revenue trend that looks like 15% annual growth may be 0% real growth. Depending on the intended interpretation, the pipeline may need to deflate series or at minimum document the nominal vs. real distinction.

### 14.4 User interpretation risks

**Forecasts mistaken for recommendations.** Users may interpret a projected revenue growth as a buy signal. The disclaimer must be prominent, not buried. The product must never use language that bridges the gap between a fundamental projection and an investment action.

**Overconfidence in uncertainty bands.** Prediction intervals capture model-based uncertainty (parameter estimation error, noise) but not structural uncertainty (M&A, regulation, commodity shocks, management decisions). The UI must communicate that the bands are model-based, not all-encompassing.

**Anchor bias on point estimates.** Users may anchor to the central forecast and ignore the range. The ForecastChart should visually emphasize the band, not just the central line.

---

## 15. Implementation Roadmap

Each phase is a distinct unit of work that can be reviewed and merged independently. No phase creates a dependency that breaks the existing dashboard.

| Phase | Description | Key output | Pre-condition |
|---|---|---|---|
| **Phase 0** | This design document | `docs/forecast-layer-design.md` | None |
| **Phase 1** | CVM ITR quarterly data pipeline | TypeScript pipeline: `itr-parser.ts`, `itr-client.ts`, `itr-quarterly.ts`; precomputed `src/data/cvm-cache/quarterly/<TICKER>.json`; API `/api/cvm/quarterly/[ticker]` — **IMPLEMENTED** | Phase 0 |
| **Phase 2** | Normalized time-series cache | `src/lib/forecasting/time-series-builder.ts`, `time-series-types.ts`, `time-series-cache.ts`; precomputed `src/data/forecast-cache/time-series/<TICKER>.json`; API `/api/forecasting/time-series/[ticker]`; script `npm run time-series:precompute` — **IMPLEMENTED** | Phase 1 |
| **Phase 3** | Baseline forecasting models | `src/lib/forecasting/forecast-types.ts`, `period-utils.ts`, `baseline-models.ts` (naive, seasonal_naive, moving_average_4q, linear_trend), `backtest.ts`, `baseline-forecast-builder.ts`, `baseline-forecast-cache.ts`; precomputed `src/data/forecast-cache/baseline-forecasts/<TICKER>.json`; API `/api/forecasting/baseline/[ticker]`; script `npm run forecast:precompute:baseline` — **IMPLEMENTED** (TypeScript only, no Python, no ML) | Phase 2 |
| **Phase 4** | Dashboard ForecastPanel | `ForecastPanel.tsx`, `ForecastChart.tsx`, `ForecastQualityBadge.tsx`, `ForecastWarnings.tsx`; "Projeções" tab in dashboard | Phase 3 |
| **Phase 5** | Statistical models (ARIMA/SARIMA, ETS, Prophet) | Integrated into model runner and backtesting; TypeScript or offline Python; evaluated against Phase 3 baselines | Phase 3 |
| **Phase 6** | TimesFM / foundation model integration | Offline precompute only; zero-shot forecasting; evaluated against baseline and statistical models in backtesting | Phase 5 |
| **Phase 7** | Model comparison and ensemble | Model comparison table in cache and dashboard; ensemble if warranted by backtesting | Phase 5, 6 |
| **Phase 8** | Sector-specific forecast methodologies | Separate model configs for energy utilities, telecom, agribusiness; exclusion of banks, FIIs, ETFs | Phase 7 |

---

## Appendix A — Forecast Metric Catalogue

| `metric` key | `label` (PT-BR) | Unit | Frequency | Notes |
|---|---|---|---|---|
| `revenue` | Receita líquida | BRL_BILLION | quarterly | Primary forecast target |
| `ebit` | EBIT | BRL_BILLION | quarterly | |
| `ebitda` | EBITDA | BRL_BILLION | quarterly | Computed from EBIT + D&A when available |
| `netIncome` | Lucro líquido | BRL_BILLION | quarterly | More volatile than EBIT |
| `ebitMargin` | Margem EBIT | PERCENT | quarterly | Derived from forecasted EBIT / revenue |
| `ebitdaMargin` | Margem EBITDA | PERCENT | quarterly | Derived from forecasted EBITDA / revenue |
| `operatingCashFlow` | Fluxo de caixa operacional | BRL_BILLION | quarterly | |
| `capex` | Capex | BRL_BILLION | quarterly | Lumpy; higher uncertainty |
| `freeCashFlow` | Free cash flow | BRL_BILLION | quarterly | Derived: CFO − Capex |
| `revenueGrowthYoy` | Crescimento de receita (YoY) | PERCENT | quarterly | Derived from forecasted revenue |
| `roic` | ROIC | PERCENT | annual | Phase 4+; requires invested capital estimate |

---

## Appendix B — Glossary

| Term | Definition |
|---|---|
| **DFP** | Demonstrações Financeiras Padronizadas — annual standardized financial statements filed with CVM |
| **ITR** | Informações Trimestrais — quarterly financial information filed with CVM |
| **Walk-forward validation** | Backtesting protocol where the model is trained on data up to time k and evaluated on data from k+1..k+h, with k rolling forward one period per fold |
| **MASE** | Mean Absolute Scaled Error — MAPE scaled by the error of the seasonal naive benchmark; < 1.0 means better than benchmark |
| **MAPE** | Mean Absolute Percentage Error |
| **Seasonal naive** | Forecast = the value from the same period in the previous cycle (e.g., same quarter last year); the primary benchmark for quarterly data |
| **Structural break** | A point in the time series where the underlying data-generating process changes fundamentally (e.g., a large acquisition) |
| **TimesFM** | Google Research foundation model for time-series forecasting (zero-shot capable) |
| **Precompute pipeline** | Offline script that generates forecast JSON files without running inside the Next.js application |
| **Forecast cache** | JSON files in `src/data/forecast-cache/` containing precomputed projections, model metadata and quality metrics |
