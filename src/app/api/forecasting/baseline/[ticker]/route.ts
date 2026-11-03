import { NextResponse } from "next/server";
import { withRequestedTicker } from "@/lib/coverage/fundamentals-alias";
import { getPrecomputedBaselineForecast } from "@/lib/forecasting/baseline-forecast-cache";
import { getPrecomputedQuarterlyFinancials } from "@/lib/cvm/precomputed-cache";
import { forecastSuppression } from "@/lib/coverage/comparability";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await params;
  const upper = ticker.toUpperCase().replace(/[^A-Z0-9]/g, "");

  // History before a comparability break does not describe the current
  // business: withhold forecasts until enough post-break quarters exist.
  const suppressed = forecastSuppression(upper, getPrecomputedQuarterlyFinancials(upper) ?? []);
  if (suppressed) {
    return NextResponse.json(
      { available: false, ticker: upper, suppressed: "comparability_break", message: suppressed },
      { status: 409 },
    );
  }

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

  // Same-issuer aliases (e.g. EMBJ3 → EMBR3 cache) keep the requested ticker.
  return NextResponse.json(withRequestedTicker(cache, upper));
}
