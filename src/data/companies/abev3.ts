import type { CompanyData } from "./types";

const abev3: CompanyData = {
  company: {
    name: "Ambev S.A.",
    ticker: "ABEV3",
    exchange: "B3",
    sector: "Bebidas",
    price: 12.48,
    priceChange: -0.08,
    priceChangePct: -0.64,
    marketCap: "R$ 196,2B",
    enterpriseValue: "R$ 201,4B",
    currency: "BRL",
  },
  metrics: [
    { label: "Receita",              value: "R$ 52,0B", trend: +4.8,  suffix: "TTM"       },
    { label: "Margem EBITDA",        value: "31,8%",    trend: -0.5,  suffix: "TTM"       },
    { label: "Fluxo de Caixa Livre", value: "R$ 8,5B",  trend: +6.2,  suffix: "TTM"       },
    { label: "Dividend Yield",       value: "5,8%",     trend: +0.4,  suffix: "proventos" },
    { label: "P/L",                  value: "16,4x",    trend: -0.7,  suffix: "NTM"       },
    { label: "ROE",                  value: "19,2%",    trend: -1.4,  suffix: "ÚLT. 12M"  },
  ],
  financials: [
    { year: "2020", receita: 44.6, ebitda: 13.8, fcl: 6.9 },
    { year: "2021", receita: 47.2, ebitda: 14.9, fcl: 7.2 },
    { year: "2022", receita: 49.1, ebitda: 15.5, fcl: 7.6 },
    { year: "2023", receita: 50.8, ebitda: 15.9, fcl: 8.1 },
    { year: "2024", receita: 52.0, ebitda: 16.5, fcl: 8.5 },
  ],
  fundamentals: {
    currentRevenue:    52.0,
    sharesOutstanding: 15.72,
    netDebt:           5.2,
  },
  multiples: [
    { company: "Ambev",        ticker: "ABEV3", pe: "16,4x", evEbitda: "12,2x", evSales: "3,9x", highlight: true  },
    { company: "BRF",          ticker: "BRFS3", pe: "24,8x", evEbitda: "9,4x",  evSales: "1,1x", highlight: false },
    { company: "São Martinho", ticker: "SMTO3", pe: "12,1x", evEbitda: "7,8x",  evSales: "2,4x", highlight: false },
    { company: "Natura &Co",   ticker: "NTCO3", pe: "19,6x", evEbitda: "8,3x",  evSales: "1,4x", highlight: false },
    { company: "Raízen",       ticker: "RAIZ4", pe: "28,4x", evEbitda: "11,2x", evSales: "0,5x", highlight: false },
  ],
  news: [
    { source: "Ambev RI",  date: "30 abr. 2026", title: "Ambev reporta volume de cerveja +2,1% no Brasil no 1T26, receita líquida cresce 5,8%",  category: "Resultado"      },
    { source: "CVM / B3",  date: "20 abr. 2026", title: "Ambev anuncia JCP de R$ 0,29 por ação, pagamento em 28/05",                             category: "Proventos"      },
    { source: "Broadcast", date: "12 abr. 2026", title: "Inflação de insumos agrícolas pressiona margens de bebidas no 2T26, alerta analista",    category: "Macro"          },
    { source: "Broadcast", date: "05 abr. 2026", title: "Ambev confirma expansão da capacidade da cervejaria em Camaçari para atender demanda NE", category: "Fato Relevante" },
  ],
};

export default abev3;
