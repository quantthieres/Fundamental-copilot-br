import { NextResponse } from "next/server";
import { B3_UNIVERSE } from "@/data/b3-universe";
import { getInstrumentInfo } from "@/lib/instruments/instrument-info";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await params;
  const normalized = ticker.toUpperCase();
  const asset = B3_UNIVERSE.find(a => a.ticker === normalized);

  const info = getInstrumentInfo(normalized, asset);
  return NextResponse.json(info, { status: 200 });
}
