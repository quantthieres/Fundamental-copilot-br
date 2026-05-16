import { NextResponse } from "next/server";
import { getPrecomputedBaselineForecast } from "@/lib/forecasting/baseline-forecast-cache";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await params;
  const upper = ticker.toUpperCase().replace(/[^A-Z0-9]/g, "");

  const cache = getPrecomputedBaselineForecast(upper);

  if (!cache) {
    return NextResponse.json(
      {
        available: false,
        ticker: upper,
        message:
          "Baseline forecast cache not available for this ticker. " +
          "Run: npm run forecast:precompute:baseline",
      },
      { status: 404 },
    );
  }

  return NextResponse.json(cache);
}
