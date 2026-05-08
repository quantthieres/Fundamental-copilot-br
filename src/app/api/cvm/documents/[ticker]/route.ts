import { NextResponse } from "next/server";
import { getCvmCompanyByTicker } from "@/lib/cvm/company-map";
import { fetchCvmDocuments } from "@/lib/cvm/documents-client";
import type { CvmDocumentsResponse } from "@/lib/cvm/documents-types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await params;
  const upper = ticker.toUpperCase();
  const updatedAt = new Date().toISOString();

  const company = getCvmCompanyByTicker(upper);

  if (!company || !company.hasCvmMapping || !company.cvmCode) {
    const body: CvmDocumentsResponse = {
      ticker: upper,
      companyName: company?.companyName ?? upper,
      source: "CVM",
      documents: [],
      updatedAt,
      error: "Sem mapeamento CVM verificado para este ticker.",
    };
    return NextResponse.json(body);
  }

  const documents = await fetchCvmDocuments(upper, company.cvmCode);

  const body: CvmDocumentsResponse = {
    ticker: upper,
    companyName: company.companyName,
    source: "CVM",
    documents,
    updatedAt,
  };

  return NextResponse.json(body);
}
