import type { CompanyData } from "./types";

const vivt3: CompanyData = {
  company: {
    name: "Telefônica Brasil S.A.",
    ticker: "VIVT3",
    exchange: "B3",
    sector: "Telecomunicações",
    price: 52.85,
    priceChange: +0.31,
    priceChangePct: +0.59,
    marketCap: "R$ 92,6B",
    enterpriseValue: "R$ 105,3B",
    currency: "BRL",
  },
  metrics: [
    { label: "Receita",              value: "R$ 55,4B", trend: +7.2,  suffix: "TTM"       },
    { label: "Margem EBITDA",        value: "41,6%",    trend: +1.2,  suffix: "TTM"       },
    { label: "Fluxo de Caixa Livre", value: "R$ 8,2B",  trend: +11.4, suffix: "TTM"       },
    { label: "Dividend Yield",       value: "6,9%",     trend: +0.6,  suffix: "proventos" },
    { label: "P/L",                  value: "15,2x",    trend: -0.4,  suffix: "NTM"       },
    { label: "ROE",                  value: "16,8%",    trend: +0.9,  suffix: "ÚLT. 12M"  },
  ],
  financials: [
    { year: "2020", receita: 45.2, ebitda: 17.8, fcl: 5.9 },
    { year: "2021", receita: 48.4, ebitda: 19.2, fcl: 6.4 },
    { year: "2022", receita: 50.9, ebitda: 20.5, fcl: 6.9 },
    { year: "2023", receita: 52.8, ebitda: 21.8, fcl: 7.6 },
    { year: "2024", receita: 55.4, ebitda: 23.1, fcl: 8.2 },
  ],
  fundamentals: {
    currentRevenue:    55.4,
    sharesOutstanding: 1.752,
    netDebt:           12.7,
  },
  multiples: [
    { company: "Vivo (VIVT3)",          ticker: "VIVT3", pe: "15,2x", evEbitda: "6,4x", evSales: "1,9x", highlight: true  },
    { company: "TIM",                   ticker: "TIMS3", pe: "18,4x", evEbitda: "5,8x", evSales: "2,1x", highlight: false },
    { company: "Claro (América Móvil)", ticker: "AMX",   pe: "12,8x", evEbitda: "6,1x", evSales: "1,7x", highlight: false },
    { company: "Algar Telecom",         ticker: "ALGR3", pe: "14,1x", evEbitda: "5,2x", evSales: "1,4x", highlight: false },
    { company: "Oi",                    ticker: "OIBR3", pe: "—",     evEbitda: "—",    evSales: "0,2x", highlight: false },
  ],
  news: [
    { source: "Vivo RI",   date: "28 abr. 2026", title: "Telefônica Brasil reporta receita de R$ 14,2B no 1T26, crescimento de 7,5% a/a",      category: "Resultado"   },
    { source: "CVM / B3",  date: "17 abr. 2026", title: "Vivo anuncia JCP de R$ 1,82 por ação, pagamento em 30/05",                            category: "Proventos"   },
    { source: "Anatel",    date: "10 abr. 2026", title: "Anatel publica novo plano de expansão de 5G para municípios acima de 30 mil hab.",      category: "Regulatório" },
    { source: "Broadcast", date: "04 abr. 2026", title: "ARPU de dados móveis cresce 8,2% no trimestre, impulsionado por planos premium",       category: "Macro"       },
  ],
};

export default vivt3;
