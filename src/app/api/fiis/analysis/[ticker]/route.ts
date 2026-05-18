import { NextRequest, NextResponse } from "next/server";
import { readFiiCache } from "@/lib/fiis/fii-cache";
import { B3_UNIVERSE } from "@/data/b3-universe";
import type { FiiAnalysisResponse } from "@/lib/fiis/fii-types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker: rawTicker } = await params;
  const ticker = rawTicker.toUpperCase().replace(/[^A-Z0-9]/g, "");

  const cached = readFiiCache(ticker);
  if (cached) return NextResponse.json(cached);

  const b3Entry = B3_UNIVERSE.find(a => a.ticker === ticker);

  const unavailable: FiiAnalysisResponse = {
    ticker,
    source: "fii_analysis",
    sourceDetail: "fii_unavailable",
    available: false,
    fund: b3Entry ? { ticker, name: b3Entry.companyName } : undefined,
    records: [],
    indicators: null,
    updatedAt: new Date().toISOString(),
    warnings: ["Dados de FII ainda não disponíveis para este ticker."],
  };

  return NextResponse.json(unavailable);
}
