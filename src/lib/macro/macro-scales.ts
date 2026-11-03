// Fixed, indicator-specific color scales for the Macro Map.
//
// Bins are fixed (never quantiles) so colors stay comparable across years.
// A value v falls in bin i when boundaries[i-1] <= v < boundaries[i]; the
// first bin is open below and the last bin open above.
//
// Palettes avoid a red-vs-green encoding: sequential scales use a single hue
// ramp; the GDP diverging scale uses brown/orange (contraction) vs blue
// (growth), with the 0% boundary marked in the legend. Status and value are
// always also shown as text (tooltip, ranking, country panel).
//
// No @/ imports — pure data, safe for client and server.

import type { MacroIndicatorId } from "./macro-types";

export interface MacroColorScale {
  indicator: MacroIndicatorId;
  kind: "sequential" | "diverging";
  /** Ascending bin boundaries (n boundaries → n+1 bins). */
  boundaries: readonly number[];
  /** One color per bin (boundaries.length + 1). */
  colors: readonly string[];
  /** Diverging only: index of the boundary that represents zero. */
  zeroBoundaryIndex?: number;
}

export const MACRO_NO_DATA_COLOR = "#e9edf2";
/** Geometry outside the Macro Map country table (e.g. Greenland, W. Sahara). */
export const MACRO_UNCOVERED_COLOR = "#f1f4f8";

export const MACRO_SCALES: Readonly<Record<MacroIndicatorId, MacroColorScale>> = {
  // Upper tail split at 20% and 50% so high- and very-high-inflation economies
  // stay distinguishable; deflation falls in the first bin.
  inflation: {
    indicator: "inflation",
    kind: "sequential",
    boundaries: [2, 4, 6, 10, 20, 50],
    colors: ["#fdf0c7", "#fcd38a", "#f9a94e", "#ec7a2c", "#c9541a", "#8f3510", "#5c210a"],
  },
  // Extra resolution near zero (<1%, 1–2%) for low-rate economies.
  policy_rate: {
    indicator: "policy_rate",
    kind: "sequential",
    boundaries: [1, 2, 4, 6, 10, 15],
    colors: ["#eef4fc", "#d0e0f7", "#a9c6ef", "#7aa6e3", "#4c82d2", "#2a5fb5", "#173f86"],
  },
  real_gdp_growth: {
    indicator: "real_gdp_growth",
    kind: "diverging",
    boundaries: [-2, 0, 2, 4, 6],
    colors: ["#a2481a", "#eea36a", "#c9def2", "#88b4e0", "#4b86c8", "#1f5ea8"],
    zeroBoundaryIndex: 1,
  },
  unemployment: {
    indicator: "unemployment",
    kind: "sequential",
    boundaries: [4, 6, 8, 12, 20],
    colors: ["#e0f3ef", "#b2e0d6", "#79c6b8", "#43a497", "#1f7f76", "#0d5652"],
  },
  gov_debt_gdp: {
    indicator: "gov_debt_gdp",
    kind: "sequential",
    boundaries: [30, 60, 90, 120, 150],
    colors: ["#ede8f7", "#d2c6ec", "#b09fdc", "#8b76c7", "#6650a9", "#432f80"],
  },
};

/** Bin index for a value, or null for missing/non-finite values. */
export function scaleBinIndex(scale: MacroColorScale, value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  let i = 0;
  while (i < scale.boundaries.length && value >= scale.boundaries[i]) i++;
  return i;
}

export function colorForValue(indicator: MacroIndicatorId, value: number | null | undefined): string {
  const scale = MACRO_SCALES[indicator];
  const bin = scaleBinIndex(scale, value);
  return bin === null ? MACRO_NO_DATA_COLOR : scale.colors[bin];
}

function fmtBound(n: number): string {
  return String(n).replace("-", "−").replace(".", ",");
}

export interface MacroLegendBin {
  color: string;
  /** Interval label, e.g. "< 2", "2–4", "≥ 50" (unit appended by the caller). */
  label: string;
  /** True for the bin whose lower edge is the zero boundary (diverging scales). */
  startsAtZero: boolean;
}

export function legendBins(indicator: MacroIndicatorId): MacroLegendBin[] {
  const { boundaries, colors, zeroBoundaryIndex } = MACRO_SCALES[indicator];
  return colors.map((color, i) => {
    let label: string;
    if (i === 0) label = `< ${fmtBound(boundaries[0])}`;
    else if (i === boundaries.length) label = `≥ ${fmtBound(boundaries[i - 1])}`;
    else label = `${fmtBound(boundaries[i - 1])} a ${fmtBound(boundaries[i])}`;
    return { color, label, startsAtZero: zeroBoundaryIndex !== undefined && i === zeroBoundaryIndex + 1 };
  });
}
