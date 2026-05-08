import type { CompanyData } from "./types";

const wege3: CompanyData = {
  company: {
    name: "WEG S.A.",
    ticker: "WEGE3",
    exchange: "B3",
    sector: "Bens de Capital",
    price: 38.54,
    priceChange: +0.42,
    priceChangePct: +1.10,
    marketCap: "R$ 145,3B",
    enterpriseValue: "R$ 148,1B",
    currency: "BRL",
  },
  metrics: [
    { label: "Receita",              value: "R$ 34,2B", trend: +12.1, suffix: "TTM"       },
    { label: "Margem EBITDA",        value: "22,8%",    trend: +0.4,  suffix: "TTM"       },
    { label: "Fluxo de Caixa Livre", value: "R$ 5,1B",  trend: +15.9, suffix: "TTM"       },
    { label: "Dividend Yield",       value: "2,1%",     trend: +0.2,  suffix: "proventos" },
    { label: "P/L",                  value: "32,4x",    trend: -1.8,  suffix: "NTM"       },
    { label: "ROE",                  value: "27,4%",    trend: +1.1,  suffix: "ÚLT. 12M"  },
  ],
  financials: [
    { year: "2020", receita: 16.7, ebitda: 3.2, fcl: 2.8 },
    { year: "2021", receita: 22.4, ebitda: 4.6, fcl: 3.4 },
    { year: "2022", receita: 27.9, ebitda: 5.8, fcl: 3.9 },
    { year: "2023", receita: 30.8, ebitda: 6.9, fcl: 4.4 },
    { year: "2024", receita: 34.2, ebitda: 7.8, fcl: 5.1 },
  ],
  fundamentals: {
    currentRevenue:    34.2,
    sharesOutstanding: 3.77,
    netDebt:           2.8,
  },
  multiples: [
    { company: "WEG S.A.",        ticker: "WEGE3", pe: "32,4x", evEbitda: "28,1x", evSales: "4,3x", highlight: true  },
    { company: "Embraer",         ticker: "EMBR3", pe: "18,7x", evEbitda: "11,4x", evSales: "1,8x", highlight: false },
    { company: "Tupy",            ticker: "TUPY3", pe: "10,2x", evEbitda: "6,3x",  evSales: "0,9x", highlight: false },
    { company: "Iochpe-Maxion",   ticker: "MYPK3", pe: "8,4x",  evEbitda: "5,1x",  evSales: "0,6x", highlight: false },
    { company: "Frasle Mobility", ticker: "FRAS3", pe: "14,6x", evEbitda: "9,8x",  evSales: "1,4x", highlight: false },
  ],
  news: [
    { source: "WEG RI",    date: "28 abr. 2026", title: "WEG divulga Resultados do 1T26: Lucro Líquido de R$ 1,42B, crescimento de 19% a/a",                             category: "Resultado"      },
    { source: "CVM / B3",  date: "22 abr. 2026", title: "Fato Relevante: WEG conclui aquisição de fabricante alemã de inversores de frequência por €310M",               category: "Fato Relevante" },
    { source: "WEG RI",    date: "15 abr. 2026", title: "Comunicado ao Mercado: Aprovação de JCP e dividendos — R$ 0,18 por ação, pagamento em 20/05",                   category: "Proventos"      },
    { source: "Broadcast", date: "09 abr. 2026", title: "Copom mantém Selic em 13,25%; analistas revisam múltiplos do setor industrial brasileiro",                       category: "Macro"          },
  ],
};

export default wege3;
