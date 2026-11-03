// Badge shown next to a ticker in search dropdowns. Historical codes say so
// explicitly (and name the current code) instead of showing a coverage badge;
// selecting them is unchanged — no silent redirect.

import { COVERAGE_BADGE, type CoverageBadge } from "../../data/coverage-types";
import type { B3Asset } from "../../data/b3-universe";
import { lifecycleHintPt } from "./ticker-lifecycle";

const HISTORICAL_BADGE_STYLE = { bg: "#f1f5f9", color: "#64748b" } as const;

export function searchBadgeFor(asset: Pick<B3Asset, "ticker" | "coverageStatus">): CoverageBadge {
  const hint = lifecycleHintPt(asset.ticker);
  return hint ? { label: hint, ...HISTORICAL_BADGE_STYLE } : COVERAGE_BADGE[asset.coverageStatus];
}
