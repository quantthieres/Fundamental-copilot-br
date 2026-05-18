import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { B3_UNIVERSE } from "@/data/b3-universe";
import { readInsuranceCache } from "@/lib/insurance/insurance-cache";
import type { InsuranceAnalysisResponse } from "@/lib/insurance/insurance-types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker: rawTicker } = await params;
  const ticker = rawTicker.toUpperCase().replace(/[^A-Z0-9]/g, "");

  if (!ticker) {
    return NextResponse.json({ error: "Missing ticker" }, { status: 400 });
  }

  const b3Entry = B3_UNIVERSE.find(a => a.ticker === ticker);
  const cached  = readInsuranceCache(ticker);

  if (cached) {
    return NextResponse.json(cached);
  }

  const unavailable: InsuranceAnalysisResponse = {
    ticker,
    source: "insurance_analysis",
    sourceDetail: "insurance_unavailable",
    available: false,
    company: b3Entry
      ? { ticker, companyName: b3Entry.companyName }
      : undefined,
    annual: [],
    indicators: null,
    updatedAt: new Date().toISOString(),
    warnings: ["Dados de seguradora ainda não disponíveis para este ticker."],
  };

  return NextResponse.json(unavailable);
}
