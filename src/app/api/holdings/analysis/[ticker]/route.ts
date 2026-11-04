import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { readHoldingCache } from "@/lib/holdings/holding-cache";
import { buildHoldingAnalysisResponse } from "@/lib/holdings/holding-analysis";

// Committed issuer cache only (src/data/holding-cache) — no CVM/IR/PDF access
// at request time. ITSA3 → ITSA4 and BRAP3 → BRAP4 share the issuer cache; the
// payload keeps the requested ticker. Quotes come from /api/market-data/[ticker].
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker: rawTicker } = await params;
  const ticker = rawTicker.toUpperCase().replace(/[^A-Z0-9]/g, "");

  if (!ticker) {
    return NextResponse.json({ error: "Missing ticker" }, { status: 400 });
  }

  const body = buildHoldingAnalysisResponse(ticker, readHoldingCache(ticker));
  const status = !body.available && body.reason === "unsupported_ticker" ? 404 : 200;
  return NextResponse.json(body, { status });
}
