import type { B3Asset } from "@/data/b3-universe";
import { classifyAsset } from "./asset-classifier";
import type { AssetType as RichAssetType } from "./coverage-types";
import { getBankCoverageReason } from "@/lib/banks/bank-coverage";
import { getFiiCoverageReason } from "@/lib/fiis/fii-coverage";
import { getInsuranceCoverageReason } from "@/lib/insurance/insurance-coverage";

export type { RichAssetType };

// Derive the richer asset type from a B3Asset (uses explicit ticker map + sector).
export function classifyB3Asset(asset: B3Asset): RichAssetType {
  return classifyAsset(asset.ticker, {
    b3AssetType: asset.assetType,
    sector:      asset.sector,
    companyName: asset.companyName,
  });
}

export function getAssetTypeLabel(richType: RichAssetType): string {
  const labels: Record<RichAssetType, string> = {
    common_stock:    "Ação ON",
    preferred_stock: "Ação PN",
    unit:            "Unit",
    bank:            "Banco",
    insurance:       "Seguradora",
    financial:       "Financeiro",
    fii:             "FII",
    etf:             "ETF",
    bdr:             "BDR",
    fund:            "Fundo",
    unknown:         "—",
  };
  return labels[richType] ?? "—";
}

export function getCoverageReason(asset: B3Asset): string {
  const richType = classifyB3Asset(asset);

  switch (asset.coverageStatus) {
    case "full_analysis":
      return "Dashboard completo com indicadores financeiros e diagnóstico fundamentalista.";
    case "cvm_analysis":
      return "Análise fundamentalista automática com dados CVM da DFP anual.";
    case "cvm_financials":
      return "Dados financeiros CVM disponíveis; histórico em expansão.";
    case "quote_only":
      return "Apenas dados de mercado disponíveis no momento.";
    case "sector_specific_model_required":
      switch (richType) {
        case "bank":      return getBankCoverageReason(asset.ticker);
        case "insurance": return getInsuranceCoverageReason(asset.ticker);
        case "financial": return "Holding ou infraestrutura financeira — modelo específico.";
        case "fii":       return getFiiCoverageReason(asset.ticker);
        case "etf":       return "Fundo/índice — não usa demonstrações corporativas tradicionais.";
        case "bdr":       return "Recibo de ativo estrangeiro — exige tratamento específico.";
        default:          return "Ativo exige metodologia específica.";
      }
    case "unavailable":
      return "Ativo ainda sem cobertura de dados financeiros.";
    default:
      return "—";
  }
}
