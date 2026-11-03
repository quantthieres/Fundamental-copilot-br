// Read-only selected-country snapshot for the Macro Map: all five indicators
// for one country and year, from the static macro caches (one request instead
// of five indicator fetches). Never calls IMF or BIS on request.
//
//   GET /api/macro/country/BRA?year=2026
//
// Unknown country → 404; missing/malformed/out-of-range year → 400.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { normalizeIso3 } from "@/lib/macro/country-metadata";
import { getMacroCountrySnapshot, parseMacroYearParam } from "@/lib/macro/macro-cache";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ iso3: string }> },
) {
  const { iso3: rawIso3 } = await params;
  const iso3 = normalizeIso3(rawIso3);
  if (!iso3) {
    return NextResponse.json({ error: "Unknown country" }, { status: 404 });
  }

  const year = parseMacroYearParam(req.nextUrl.searchParams.get("year"));
  if (year === null || year === "invalid") {
    return NextResponse.json({ error: "Invalid year; expected YYYY" }, { status: 400 });
  }

  const snapshot = getMacroCountrySnapshot(iso3, year);
  if (!snapshot) {
    return NextResponse.json({ error: "Unknown country" }, { status: 404 });
  }
  return NextResponse.json(snapshot);
}
