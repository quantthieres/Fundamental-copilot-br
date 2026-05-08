import type { CompanyData } from "./types";

const egie3: CompanyData = {
  company: {
    name: "Engie Brasil Energia S.A.",
    ticker: "EGIE3",
    exchange: "B3",
    sector: "Energia Elétrica",
    price: 44.28,
    priceChange: +0.18,
    priceChangePct: +0.41,
    marketCap: "R$ 30,2B",
    enterpriseValue: "R$ 38,5B",
    currency: "BRL",
  },
  metrics: [
    { label: "Receita",              value: "R$ 5,5B",  trend: +8.2,  suffix: "TTM"       },
    { label: "Margem EBITDA",        value: "58,4%",    trend: +1.1,  suffix: "TTM"       },
    { label: "Fluxo de Caixa Livre", value: "R$ 2,8B",  trend: +12.3, suffix: "TTM"       },
    { label: "Dividend Yield",       value: "7,2%",     trend: +0.5,  suffix: "proventos" },
    { label: "P/L",                  value: "14,8x",    trend: -0.9,  suffix: "NTM"       },
    { label: "ROE",                  value: "32,1%",    trend: +2.4,  suffix: "ÚLT. 12M"  },
  ],
  financials: [
    { year: "2020", receita: 3.5, ebitda: 1.9, fcl: 1.8 },
    { year: "2021", receita: 3.9, ebitda: 2.2, fcl: 1.9 },
    { year: "2022", receita: 4.6, ebitda: 2.5, fcl: 2.2 },
    { year: "2023", receita: 5.1, ebitda: 2.9, fcl: 2.5 },
    { year: "2024", receita: 5.5, ebitda: 3.2, fcl: 2.8 },
  ],
  fundamentals: {
    currentRevenue:    5.5,
    sharesOutstanding: 0.682,
    netDebt:           8.3,
  },
  multiples: [
    { company: "Engie Brasil", ticker: "EGIE3",  pe: "14,8x", evEbitda: "12,1x", evSales: "7,0x", highlight: true  },
    { company: "Alupar",       ticker: "ALUP11", pe: "16,2x", evEbitda: "11,8x", evSales: "6,5x", highlight: false },
    { company: "Taesa",        ticker: "TAEE11", pe: "13,4x", evEbitda: "10,9x", evSales: "5,8x", highlight: false },
    { company: "Equatorial",   ticker: "EQTL3",  pe: "18,7x", evEbitda: "9,2x",  evSales: "1,2x", highlight: false },
    { company: "ISA CTEEP",    ticker: "TRPL4",  pe: "11,9x", evEbitda: "9,6x",  evSales: "5,2x", highlight: false },
  ],
  news: [
    { source: "Engie RI",  date: "28 abr. 2026", title: "Engie Brasil registra EBITDA de R$ 822M no 1T26, alta de 11% a/a",                    category: "Resultado"   },
    { source: "CVM / B3",  date: "15 abr. 2026", title: "Engie Brasil anuncia dividendos de R$ 1,85 por ação, pagamento em 22/05",              category: "Proventos"   },
    { source: "ANEEL",     date: "08 abr. 2026", title: "ANEEL aprova reajuste tarifário para contratos de geração hidrelétrica",                category: "Regulatório" },
    { source: "Broadcast", date: "02 abr. 2026", title: "Energia hidrelétrica responde por 61% da matriz elétrica no 1T26",                     category: "Macro"       },
  ],
};

export default egie3;
