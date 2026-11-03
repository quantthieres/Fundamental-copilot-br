// Read-only Macro Map endpoint: one indicator for one year, for every country.
// Reads the precomputed normalized cache in src/data/macro-cache — never calls
// IMF or BIS on request.
//
//   GET /api/macro/inflation?year=2026
//   GET /api/macro/policy_rate            (default year = source vintage year)
//
// The indicator accepts the machine id or its kebab-case slug
// (real_gdp_growth / real-gdp-growth). Unknown indicator → 404; malformed or
// out-of-range year → 400; missing cache → 503.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { parseMacroIndicatorParam, MACRO_INDICATOR_IDS } from "@/lib/macro/macro-indicators";
import { getMacroIndicatorView, parseMacroYearParam } from "@/lib/macro/macro-cache";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ indicator: string }> },
) {
  const { indicator: rawIndicator } = await params;
  const indicator = parseMacroIndicatorParam(rawIndicator);
  if (!indicator) {
    return NextResponse.json(
      { error: "Unknown indicator", supported: MACRO_INDICATOR_IDS },
      { status: 404 },
    );
  }

  const year = parseMacroYearParam(req.nextUrl.searchParams.get("year"));
  if (year === "invalid") {
    return NextResponse.json(
      { error: "Invalid year; expected YYYY" },
      { status: 400 },
    );
  }

  const view = getMacroIndicatorView(indicator, year);
  if (!view) {
    return NextResponse.json(
      { error: "Macro cache not available for this indicator" },
      { status: 503 },
    );
  }

  return NextResponse.json(view);
}
