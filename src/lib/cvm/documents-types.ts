// Types for the CVM documents/events integration.
// Documents are fetched from the CVM ENET search API (efts.cvm.gov.br)
// which exposes structured and unstructured filings from companies registered
// with the Comissão de Valores Mobiliários.

export interface CvmDocument {
  id: string;
  /** ISO date string (YYYY-MM-DD) — DtRecebimento from CVM ENET */
  date: string;
  /** Friendly category label derived from CodTipoDocumento */
  category: string;
  /** Document subject/title */
  title: string;
  /** Raw CVM document type code, e.g. "DFP", "ITR", "FRE" */
  type?: string;
  /** Direct URL to the CVM RAD document viewer — only set when real data is available */
  url?: string;
  source: "CVM";
}

export interface CvmDocumentsResponse {
  ticker: string;
  companyName: string;
  source: "CVM";
  documents: CvmDocument[];
  /** ISO timestamp of when the data was fetched */
  updatedAt: string;
  error?: string;
}

// ─── Raw shape from the CVM ENET search API ──────────────────────────────────
// https://efts.cvm.gov.br/EFTS/quick?query=&codigoCvm={cvmCode}&tipoEmpresa=O
// Response is Elasticsearch-style JSON. We model only what we need.

export interface EnetHitSource {
  CodCvm?: string;
  NomPessoa?: string;
  NumProtocolo?: string;
  DtRecebimento?: string;
  CodTipoDocumento?: string;
  SgDocumento?: string;
  DescTipoDocumento?: string;
  NumSequencia?: string | number;
  NumVersao?: string | number;
  Assunto?: string;
  LinkDoc?: string;
}

export interface EnetHit {
  _id?: string;
  _source?: EnetHitSource;
}

export interface EnetResponse {
  hits?: {
    total?: { value?: number };
    hits?: EnetHit[];
  };
}
