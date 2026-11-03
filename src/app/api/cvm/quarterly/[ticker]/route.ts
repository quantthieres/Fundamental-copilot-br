import { NextResponse } from "next/server";
import { getCvmCompanyByTicker } from "@/lib/cvm/company-map";
import { resolveFundamentalsTicker } from "@/lib/coverage/fundamentals-alias";
import { getPrecomputedQuarterlyFinancials } from "@/lib/cvm/precomputed-cache";
import { getQuarterlyItrFinancials } from "@/lib/cvm/itr-client";
import { getPrecomputedFinancials } from "@/lib/cvm/precomputed-cache";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await params;
  const upper = ticker.toUpperCase();
  const t0 = process.env.NODE_ENV === "development" ? Date.now() : 0;

  // Same-issuer aliases (e.g. AXIA3 → ELET3 cache) resolve the CVM company and
  // caches of the canonical ticker; the response keeps the requested ticker.
  const company = getCvmCompanyByTicker(resolveFundamentalsTicker(upper));

  if (!company || !company.hasCvmMapping || !company.cvmCode) {
    return NextResponse.json({
      ticker: upper,
      source: "cvm_itr_quarterly",
      error: "No verified CVM mapping for this ticker.",
      company: company ?? { ticker: upper, hasCvmMapping: false },
      quarterly: [],
    });
  }

  const companyInfo = {
    ticker:      upper,
    companyName: company.companyName,
    cvmCode:     company.cvmCode,
    cnpj:        company.cnpj ?? "",
  };

  // Cache-first: return precomputed snapshot when available (<1ms).
  const cached = getPrecomputedQuarterlyFinancials(upper);
  if (cached !== null) {
    if (process.env.NODE_ENV === "development") {
      console.log(`[api/cvm/quarterly] ${upper}: precomputed cache hit in ${Date.now() - t0}ms`);
    }
    return NextResponse.json({
      ticker:       upper,
      source:       "cvm_itr_quarterly",
      sourceDetail: "precomputed_cvm_itr_cache",
      company:      companyInfo,
      quarterly:    cached,
      updatedAt:    new Date().toISOString(),
    });
  }

  // Fallback: live ITR pipeline (slow — not used by the dashboard).
  try {
    const annualFinancials = getPrecomputedFinancials(upper) ?? [];
    const quarterly = await getQuarterlyItrFinancials(upper, company.cvmCode, annualFinancials);

    if (process.env.NODE_ENV === "development") {
      console.log(
        `[api/cvm/quarterly] ${upper}: live pipeline — ${quarterly.length} records in ${Date.now() - t0}ms`,
      );
    }

    return NextResponse.json({
      ticker:       upper,
      source:       "cvm_itr_quarterly",
      sourceDetail: "live_cvm_itr_pipeline",
      company:      companyInfo,
      quarterly,
      updatedAt:    new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      {
        ticker:   upper,
        source:   "cvm_itr_quarterly",
        error:    "Failed to fetch or parse ITR data.",
        company:  companyInfo,
        quarterly: [],
      },
      { status: 500 },
    );
  }
}
