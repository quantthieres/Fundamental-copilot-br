import { NextResponse } from "next/server";
import { getCvmCompanyByTicker } from "@/lib/cvm/company-map";
import { resolveFundamentalsTicker } from "@/lib/coverage/fundamentals-alias";
import { getAnnualDfpFinancials } from "@/lib/cvm/dfp-client";
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
      source: "cvm_dfp",
      error: "No verified CVM mapping for this ticker.",
      company: company ?? { ticker: upper, hasCvmMapping: false },
      financials: [],
    });
  }

  // Cache-first: return precomputed snapshot when available (<1ms).
  const cached = getPrecomputedFinancials(upper);
  if (cached !== null) {
    if (process.env.NODE_ENV === "development") {
      console.log(`[api/cvm/financials] ${upper}: precomputed cache hit in ${Date.now() - t0}ms`);
    }
    return NextResponse.json({
      ticker: upper,
      source: "cvm_dfp",
      sourceDetail: "precomputed_cvm_cache",
      company: {
        ticker:      upper,
        companyName: company.companyName,
        cvmCode:     company.cvmCode,
        cnpj:        company.cnpj,
      },
      financials: cached,
    });
  }

  // Fallback: live DFP pipeline.
  try {
    const financials = await getAnnualDfpFinancials(upper, company.cvmCode);

    if (process.env.NODE_ENV === "development") {
      console.log(`[api/cvm/financials] ${upper}: ${financials.length} years, total ${Date.now() - t0}ms`);
    }

    return NextResponse.json({
      ticker: upper,
      source: "cvm_dfp",
      company: {
        ticker:      upper,
        companyName: company.companyName,
        cvmCode:     company.cvmCode,
        cnpj:        company.cnpj,
      },
      financials,
    });
  } catch {
    return NextResponse.json({
      ticker: upper,
      source: "cvm_dfp",
      error: "Failed to fetch or parse DFP data.",
      company: {
        ticker:      upper,
        companyName: company.companyName,
        cvmCode:     company.cvmCode,
        cnpj:        company.cnpj,
      },
      financials: [],
    });
  }
}
