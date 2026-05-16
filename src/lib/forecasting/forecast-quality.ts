import type {
  MetricForecastResult,
  ForecastMetric,
  ForecastQualityDiagnostic,
  ForecastReliabilityLevel,
} from "./forecast-types";

export type { ForecastReliabilityLevel, ForecastQualityDiagnostic } from "./forecast-types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isPartialCurrentYear(period: string | null): boolean {
  if (!period) return false;
  try {
    const [yearStr, qStr] = period.split("Q");
    return parseInt(yearStr, 10) === new Date().getFullYear() && parseInt(qStr, 10) < 4;
  } catch {
    return false;
  }
}

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

// ─── Main function ────────────────────────────────────────────────────────────

// Accepts the forecast result without the quality field (used during construction).
export function computeForecastQuality(
  metricForecast: Omit<MetricForecastResult, "quality">,
): ForecastQualityDiagnostic {
  const {
    metric,
    modelSelected,
    observations,
    backtest,
    forecast,
    hasNegativeValues,
    hasLargeOutliers,
    lastObservedPeriod,
  } = metricForecast;

  const selectedBacktest = backtest.find(b => b.model === modelSelected);
  const bm = selectedBacktest?.metrics;
  const wape  = bm?.wape  ?? null;
  const smape = bm?.smape ?? null;
  const mae   = bm?.mae   ?? null;
  const rmse  = bm?.rmse  ?? null;

  const nonNullCount    = forecast.filter(p => p.yhat !== null).length;
  const forecastCoverage = forecast.length > 0 ? nonNullCount / forecast.length : 0;
  const hasIncompleteCurrentYear = isPartialCurrentYear(lastObservedPeriod);

  const inputs: ForecastQualityDiagnostic["inputs"] = {
    observations, wape, smape, mae, rmse,
    hasNegativeValues, hasLargeOutliers,
    hasIncompleteCurrentYear, forecastCoverage,
  };

  const reasons:  string[] = [];
  const warnings: string[] = [];

  // ── Insufficient: no model or too few observations ─────────────────────────

  if (modelSelected === null) {
    return {
      level: "insufficient", score: 0,
      reasons: ["Nenhum modelo elegível: dados insuficientes para gerar projeções."],
      warnings: [], inputs,
    };
  }

  if (observations < 8) {
    const s = observations === 1 ? "" : "s";
    return {
      level: "insufficient", score: 0,
      reasons: [`Histórico insuficiente: ${observations} observação${s} disponível. Mínimo recomendado: 8 trimestres.`],
      warnings: [], inputs,
    };
  }

  // ── Scoring ────────────────────────────────────────────────────────────────

  let score = 100;

  // Observation count
  if (observations < 16) {
    score -= 25;
    reasons.push("Histórico curto (8–15 trimestres): maior incerteza nas projeções.");
  } else if (observations < 24) {
    score -= 10;
    reasons.push("Histórico moderado (16–23 trimestres): projeções melhoram com mais períodos.");
  }

  // WAPE penalties (select the highest applicable tier; tiers are mutually exclusive)
  if (wape !== null) {
    if (wape > 0.50) {
      score -= 35;
      reasons.push(`WAPE muito elevado (${pct(wape)}): erro de retroteste alto indica baixa estabilidade histórica.`);
    } else if (wape > 0.30) {
      score -= 25;
      reasons.push(`WAPE elevado (${pct(wape)}): variabilidade significativa nos erros do retroteste.`);
    } else if (wape > 0.15) {
      score -= 15;
      reasons.push(`WAPE moderado (${pct(wape)}): alguma imprecisão observada no retroteste.`);
    } else if (wape > 0.10) {
      score -= 8;
      reasons.push(`WAPE acima de 10% (${pct(wape)}): projeções razoavelmente precisas no retroteste.`);
    }
  }

  // sMAPE penalties
  if (smape !== null) {
    if (smape > 0.50) {
      score -= 25;
      warnings.push(`sMAPE muito elevado (${pct(smape)}): alta variabilidade relativa nos erros de previsão.`);
    } else if (smape > 0.30) {
      score -= 15;
      warnings.push(`sMAPE elevado (${pct(smape)}): variabilidade relativa moderada nos erros.`);
    }
  }

  // Negative values — revenue gets a stronger penalty than other metrics
  if (hasNegativeValues) {
    if (metric === "revenue") {
      score -= 10;
      warnings.push("Receita com valores negativos é incomum e pode indicar problema nos dados ou evento extraordinário.");
    } else {
      score -= 5;
      warnings.push("Série histórica com valores negativos. Para esta métrica isso pode ser esperado em alguns períodos.");
    }
  }

  // Large outliers
  if (hasLargeOutliers) {
    score -= 15;
    warnings.push("Outliers de grande amplitude detectados na série histórica: podem distorcer as projeções.");
  }

  // Incomplete current year
  if (hasIncompleteCurrentYear) {
    score -= 5;
    reasons.push(`Último período observado (${lastObservedPeriod}) pertence ao ano corrente ainda incompleto.`);
  }

  // Forecast coverage
  if (forecastCoverage < 1) {
    score -= 20;
    reasons.push(`Cobertura parcial: ${Math.round(forecastCoverage * 100)}% dos horizontes possuem valor projetado.`);
  }

  score = Math.max(0, Math.min(100, score));

  const level: ForecastReliabilityLevel =
    score >= 80 ? "high" :
    score >= 60 ? "medium" :
    "low";

  return { level, score, reasons, warnings, inputs };
}
