import { B3_UNIVERSE } from "@/data/b3-universe";
import type { B3Asset } from "@/data/b3-universe";
import type { InformationalInstrumentType, InstrumentInfoResponse } from "./instrument-types";

// ─── Type resolution ──────────────────────────────────────────────────────────

function resolveInstrumentType(asset: B3Asset): InformationalInstrumentType {
  if (asset.assetType === "etf")  return "etf";
  if (asset.assetType === "bdr")  return "bdr";
  if (asset.assetType === "fii")  return "fund";
  return "unknown";
}

// ─── ETF descriptions ─────────────────────────────────────────────────────────

const ETF_DESCRIPTIONS: Record<string, string> = {
  BOVA11:  "Fundo de índice que replica o Ibovespa, o principal índice de ações da B3.",
  IVVB11:  "Fundo de índice que replica o S&P 500, cesta dos 500 maiores ativos da bolsa americana.",
  SMAL11:  "Fundo de índice focado em small caps brasileiras, rastreando o SMLL B3.",
  HASH11:  "Fundo de índice de criptoativos que rastreia o Nasdaq Crypto Index.",
  SPXI11:  "Fundo de índice que replica o S&P 500 com exposição denominada em BRL.",
  GOLD11:  "Fundo de índice lastreado em ouro (commodities) listado na B3.",
};

function etfDescription(asset: B3Asset): string {
  return (
    ETF_DESCRIPTIONS[asset.ticker] ??
    `Fundo de índice (ETF) que rastreia ${asset.subsector || "um índice ou classe de ativos"}. ` +
    "Estruturado como fundo listado em bolsa, não como empresa operacional."
  );
}

// ─── BDR descriptions ─────────────────────────────────────────────────────────

const BDR_DESCRIPTIONS: Record<string, string> = {
  AAPL34:  "BDR que representa ações da Apple Inc. (AAPL), listada na Nasdaq (EUA). Exposição ao setor de tecnologia/consumo norte-americano.",
  MSFT34:  "BDR que representa ações da Microsoft Corporation (MSFT), listada na Nasdaq (EUA). Exposição ao setor de software e nuvem.",
  TSLA34:  "BDR que representa ações da Tesla Inc. (TSLA), listada na Nasdaq (EUA). Exposição ao setor de veículos elétricos e energia.",
  AMZO34:  "BDR que representa ações da Amazon.com Inc. (AMZN), listada na Nasdaq (EUA). Exposição ao setor de comércio eletrônico e nuvem.",
  GOGL34:  "BDR que representa ações da Alphabet Inc. (GOOGL), listada na Nasdaq (EUA). Exposição ao setor de tecnologia e publicidade digital.",
  NVDC34:  "BDR que representa ações da NVIDIA Corporation (NVDA), listada na Nasdaq (EUA). Exposição ao setor de semicondutores e IA.",
  GOOGL34: "BDR que representa ações da Alphabet Inc. (GOOGL), listada na Nasdaq (EUA). Exposição ao setor de tecnologia e publicidade digital.",
};

function bdrDescription(asset: B3Asset): string {
  return (
    BDR_DESCRIPTIONS[asset.ticker] ??
    `BDR que representa exposição a ${asset.companyName}, empresa estrangeira. ` +
    "O recibo é negociado na B3 mas a empresa subjacente não reporta pela estrutura CVM brasileira."
  );
}

// ─── Why no fundamental analysis ─────────────────────────────────────────────

const WHY_NO_FA: Record<InformationalInstrumentType, string> = {
  etf:     "ETFs não publicam demonstrações financeiras corporativas comparáveis às de empresas operacionais.",
  bdr:     "BDRs exigem tratamento próprio, pois a empresa subjacente não reporta pela estrutura CVM de companhia brasileira.",
  fund:    "Fundos listados possuem estrutura contábil própria, incompatível com o modelo de análise fundamentalista de empresas industriais.",
  unknown: "Este instrumento não utiliza demonstrações financeiras corporativas brasileiras, portanto o modelo industrial não se aplica.",
};

// ─── Public API ───────────────────────────────────────────────────────────────

export function getInstrumentInfo(ticker: string, asset?: B3Asset): InstrumentInfoResponse {
  const resolved = asset ?? B3_UNIVERSE.find(a => a.ticker === ticker.toUpperCase());

  if (!resolved) {
    return {
      ticker,
      source:                    "instrument_info",
      sourceDetail:              "informational_layer",
      available:                 false,
      instrumentType:            "unknown",
      name:                      ticker,
      description:               "Ativo não localizado no universo B3 cadastrado.",
      whyNoFundamentalAnalysis:  WHY_NO_FA.unknown,
      marketDataAvailable:       false,
      warnings:                  ["Ticker não encontrado no universo B3."],
      updatedAt:                 new Date().toISOString(),
    };
  }

  const instrumentType = resolveInstrumentType(resolved);

  const description =
    instrumentType === "etf"  ? etfDescription(resolved) :
    instrumentType === "bdr"  ? bdrDescription(resolved) :
    `${resolved.companyName} — instrumento de mercado listado na B3.`;

  return {
    ticker:                    resolved.ticker,
    source:                    "instrument_info",
    sourceDetail:              "informational_layer",
    available:                 true,
    instrumentType,
    name:                      resolved.companyName,
    description,
    whyNoFundamentalAnalysis:  WHY_NO_FA[instrumentType],
    marketDataAvailable:       true,
    warnings:                  [
      "Esta tela tem finalidade informativa e não constitui recomendação de investimento.",
    ],
    updatedAt:                 new Date().toISOString(),
  };
}

export function getInstrumentTypeLabel(type: InformationalInstrumentType): string {
  const labels: Record<InformationalInstrumentType, string> = {
    etf:     "ETF — Fundo de Índice",
    bdr:     "BDR — Recibo de Ativo Estrangeiro",
    fund:    "Fundo Listado",
    unknown: "Instrumento de mercado",
  };
  return labels[type];
}

export function getInstrumentCoverageLabel(ticker: string): string {
  const asset = B3_UNIVERSE.find(a => a.ticker === ticker.toUpperCase());
  if (!asset) return "Informativo";
  const type = resolveInstrumentType(asset);
  if (type === "etf")  return "Informativo — ETF";
  if (type === "bdr")  return "Informativo — BDR";
  return "Informativo";
}

export function getInstrumentCoverageReason(ticker: string): string {
  const asset = B3_UNIVERSE.find(a => a.ticker === ticker.toUpperCase());
  if (!asset) return "Instrumento sem análise fundamentalista corporativa.";
  const type = resolveInstrumentType(asset);
  if (type === "etf")  return "ETF/fundo listado — não utiliza demonstrações corporativas tradicionais.";
  if (type === "bdr")  return "Recibo de ativo estrangeiro — exige tratamento informativo próprio.";
  return "Instrumento de mercado listado — sem análise fundamentalista industrial.";
}
