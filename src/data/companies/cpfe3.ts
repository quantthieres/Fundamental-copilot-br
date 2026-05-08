import type { CompanyData } from "./types";

const cpfe3: CompanyData = {
  company: {
    name: "CPFL Energia S.A.",
    ticker: "CPFE3",
    exchange: "B3",
    sector: "Energia Elétrica",
    price: 34.72,
    priceChange: -0.15,
    priceChangePct: -0.43,
    marketCap: "R$ 32,1B",
    enterpriseValue: "R$ 52,8B",
    currency: "BRL",
  },
  metrics: [
    { label: "Receita",              value: "R$ 16,4B", trend: +5.8, suffix: "TTM"       },
    { label: "Margem EBITDA",        value: "24,2%",    trend: +0.7, suffix: "TTM"       },
    { label: "Fluxo de Caixa Livre", value: "R$ 2,1B",  trend: +9.4, suffix: "TTM"       },
    { label: "Dividend Yield",       value: "6,4%",     trend: +0.3, suffix: "proventos" },
    { label: "P/L",                  value: "12,6x",    trend: -1.1, suffix: "NTM"       },
    { label: "ROE",                  value: "18,5%",    trend: +0.8, suffix: "ÚLT. 12M"  },
  ],
  financials: [
    { year: "2020", receita: 12.8, ebitda: 2.8, fcl: 1.4 },
    { year: "2021", receita: 13.9, ebitda: 3.1, fcl: 1.6 },
    { year: "2022", receita: 14.8, ebitda: 3.4, fcl: 1.7 },
    { year: "2023", receita: 15.5, ebitda: 3.6, fcl: 1.9 },
    { year: "2024", receita: 16.4, ebitda: 3.9, fcl: 2.1 },
  ],
  fundamentals: {
    currentRevenue:    16.4,
    sharesOutstanding: 0.925,
    netDebt:           20.7,
  },
  multiples: [
    { company: "CPFL Energia", ticker: "CPFE3", pe: "12,6x", evEbitda: "8,9x",  evSales: "3,2x", highlight: true  },
    { company: "Equatorial",   ticker: "EQTL3", pe: "18,7x", evEbitda: "9,2x",  evSales: "1,2x", highlight: false },
    { company: "CEMIG",        ticker: "CMIG4", pe: "9,4x",  evEbitda: "7,1x",  evSales: "0,9x", highlight: false },
    { company: "Copel",        ticker: "CPLE6", pe: "11,2x", evEbitda: "6,8x",  evSales: "1,1x", highlight: false },
    { company: "Eneva",        ticker: "ENEV3", pe: "22,4x", evEbitda: "10,5x", evSales: "4,1x", highlight: false },
  ],
  news: [
    { source: "CPFL RI",   date: "29 abr. 2026", title: "CPFL Energia reporta lucro de R$ 642M no 1T26, crescimento de 8% a/a",             category: "Resultado"   },
    { source: "ANEEL",     date: "18 abr. 2026", title: "ANEEL reajusta tarifa de distribuição da CPFL em 4,2% para o ciclo 2026",           category: "Regulatório" },
    { source: "CVM / B3",  date: "10 abr. 2026", title: "CPFL paga dividendos de R$ 2,18 por ação, rendimento de 6,4% a/a",                 category: "Proventos"   },
    { source: "Broadcast", date: "03 abr. 2026", title: "Distribuidoras elétricas registram queda de 2% nas perdas técnicas no trimestre",   category: "Macro"       },
  ],
};

export default cpfe3;
