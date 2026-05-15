import { NextResponse } from "next/server";
import { getPrecomputedTickerTimeSeries } from "@/lib/forecasting/time-series-cache";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await params;
  const upper = ticker.toUpperCase().replace(/[^A-Z0-9]/g, "");

  const cache = getPrecomputedTickerTimeSeries(upper);

  if (!cache) {
    return NextResponse.json(
      {
        available: false,
        ticker: upper,
        message: "Time-series cache not available for this ticker.",
      },
      { status: 404 },
    );
  }

  return NextResponse.json(cache);
}
