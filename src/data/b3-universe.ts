import type { CoverageStatus, AssetType } from "./coverage-types";

export interface B3Asset {
  ticker: string;
  companyName: string;
  tradingName: string;
  sector: string;
  subsector: string;
  assetType: AssetType;
  hasMockData: boolean;
  hasCvmMapping: boolean;
  coverageStatus: CoverageStatus;
}

// Backward-compatible alias used by NavBar and page.tsx
export type B3Company = B3Asset;

// ─── helpers ─────────────────────────────────────────────────────────────────

function stock(
  ticker: string,
  companyName: string,
  tradingName: string,
  sector: string,
  subsector: string,
  coverageStatus: CoverageStatus,
  hasMockData = false,
  hasCvmMapping = false,
  assetType: AssetType = "stock",
): B3Asset {
  return { ticker, companyName, tradingName, sector, subsector, assetType, hasMockData, hasCvmMapping, coverageStatus };
}

const FA:  CoverageStatus = "full_analysis";
const CA:  CoverageStatus = "cvm_analysis";
const CVM: CoverageStatus = "cvm_financials";
const QO:  CoverageStatus = "quote_only";
const SS:  CoverageStatus = "sector_specific_model_required";

// ─── universe ─────────────────────────────────────────────────────────────────

export const B3_UNIVERSE: B3Asset[] = [

  // ── Bens de Capital ──────────────────────────────────────────────────────────
  stock("WEGE3",  "WEG S.A.",                                           "WEG",            "Bens de Capital",        "Motores e Geradores",            FA,  true,  true),
  stock("EMBR3",  "Embraer S.A.",                                        "Embraer",        "Bens de Capital",        "Aeronáutico",                    CA,  false, true),
  stock("TUPY3",  "Tupy S.A.",                                           "Tupy",           "Bens de Capital",        "Autopeças",                      CA,  false, true),
  stock("FRAS3",  "Frasle Mobility S.A.",                                "Frasle",         "Bens de Capital",        "Autopeças",                      CA,  false, true),
  stock("MYPK3",  "Iochpe-Maxion S.A.",                                  "Iochpe-Maxion",  "Bens de Capital",        "Autopeças",                      QO),
  stock("ROMI3",  "Indústrias Romi S.A.",                                "Romi",           "Bens de Capital",        "Máquinas e Equipamentos",        QO),
  stock("RAPT4",  "Randon S.A. Implementos e Participações",             "Randon",         "Bens de Capital",        "Implementos Rodoviários",        QO),
  stock("KEPL3",  "Kepler Weber S.A.",                                   "Kepler Weber",   "Bens de Capital",        "Máquinas e Equipamentos",        QO),
  stock("POMO4",  "Marcopolo S.A.",                                      "Marcopolo",      "Bens de Capital",        "Veículos e Ônibus",              QO),
  stock("TASA4",  "Taurus Armas S.A.",                                   "Taurus",         "Bens de Capital",        "Defesa e Segurança",             QO),
  stock("LEVE3",  "Metal Leve S.A.",                                     "Metal Leve",     "Bens de Capital",        "Autopeças",                      QO),
  stock("AERI3",  "Aeris Energy S.A.",                                   "Aeris",          "Bens de Capital",        "Energia Renovável",              QO),

  // ── Petróleo, Gás e Biocombustíveis ─────────────────────────────────────────
  stock("PETR4",  "Petróleo Brasileiro S.A.",                            "Petrobras PN",   "Petróleo e Gás",         "Exploração e Refino",            CA,  false, true),
  stock("PETR3",  "Petróleo Brasileiro S.A.",                            "Petrobras ON",   "Petróleo e Gás",         "Exploração e Refino",            CA,  false, true),
  stock("PRIO3",  "PRIO S.A.",                                           "PRIO",           "Petróleo e Gás",         "Exploração e Produção",          CA,  false, true),
  stock("VBBR3",  "Vibra Energia S.A.",                                  "Vibra",          "Petróleo e Gás",         "Distribuição de Combustíveis",   CA,  false, true),
  stock("RAIZ4",  "Raízen S.A.",                                         "Raízen",         "Petróleo e Gás",         "Biocombustíveis",                CA,  false, true),
  stock("RECV3",  "PetroRecôncavo S.A.",                                 "PetroRecôncavo", "Petróleo e Gás",         "Exploração e Produção",          QO),
  stock("RRRP3",  "3R Petroleum Óleo e Gás S.A.",                       "3R Petroleum",   "Petróleo e Gás",         "Exploração e Produção",          QO),
  stock("CSAN3",  "Cosan S.A.",                                          "Cosan",          "Petróleo e Gás",         "Distribuição e Energia",         QO),
  stock("UGPA3",  "Ultrapar Participações S.A.",                         "Ultrapar",       "Petróleo e Gás",         "Distribuição de Combustíveis",   QO),

  // ── Mineração ────────────────────────────────────────────────────────────────
  stock("VALE3",  "Vale S.A.",                                           "Vale",           "Mineração",              "Minério de Ferro",               CA,  false, true),
  stock("CMIN3",  "CSN Mineração S.A.",                                  "CSN Mineração",  "Mineração",              "Minério de Ferro",               QO),
  stock("BRAP4",  "Bradespar S.A.",                                      "Bradespar",      "Mineração",              "Holding Industrial",             QO),

  // ── Siderurgia e Metalurgia ──────────────────────────────────────────────────
  stock("GGBR4",  "Gerdau S.A.",                                         "Gerdau",         "Siderurgia",             "Aços Longos",                    CA,  false, true),
  stock("GGBR3",  "Gerdau S.A.",                                         "Gerdau ON",      "Siderurgia",             "Aços Longos",                    CA,  false, true),
  stock("GOAU4",  "Metalúrgica Gerdau S.A.",                             "Gerdau Met",     "Siderurgia",             "Holding Industrial",             QO),
  stock("CSNA3",  "Companhia Siderúrgica Nacional",                      "CSN",            "Siderurgia",             "Aços Planos",                    CA,  false, true),
  stock("USIM5",  "Usiminas S.A.",                                       "Usiminas",       "Siderurgia",             "Aços Planos",                    QO),
  stock("FESA4",  "Ferbasa S.A.",                                        "Ferbasa",        "Siderurgia",             "Ferro-ligas",                    QO),

  // ── Químicos e Petroquímicos ─────────────────────────────────────────────────
  stock("BRKM5",  "Braskem S.A.",                                        "Braskem",        "Químicos",               "Petroquímicos",                  QO),
  stock("UNIP6",  "Unipar Carbocloro S.A.",                              "Unipar",         "Químicos",               "Químicos Industriais",           QO),

  // ── Papel e Celulose ─────────────────────────────────────────────────────────
  stock("SUZB3",  "Suzano S.A.",                                         "Suzano",         "Papel e Celulose",       "Celulose",                       CA,  false, true),
  stock("KLBN11", "Klabin S.A.",                                         "Klabin",         "Papel e Celulose",       "Papel e Embalagens",             CA,  false, true,  "unit"),
  stock("DXCO3",  "Dexco S.A.",                                          "Dexco",          "Papel e Celulose",       "Painéis de Madeira",             QO),

  // ── Energia Elétrica ─────────────────────────────────────────────────────────
  stock("EGIE3",  "Engie Brasil Energia S.A.",                           "Engie Brasil",   "Energia Elétrica",       "Geração de Energia",             FA,  true,  true),
  stock("CPFE3",  "CPFL Energia S.A.",                                   "CPFL Energia",   "Energia Elétrica",       "Distribuição de Energia",        FA,  true,  true),
  stock("ELET3",  "Centrais Elétricas Brasileiras S.A.",                 "Eletrobras ON",  "Energia Elétrica",       "Geração e Transmissão",          CA,  false, true),
  stock("ELET6",  "Centrais Elétricas Brasileiras S.A.",                 "Eletrobras PNB", "Energia Elétrica",       "Geração e Transmissão",          QO),
  stock("EQTL3",  "Equatorial Energia S.A.",                             "Equatorial",     "Energia Elétrica",       "Distribuição de Energia",        CA,  false, true),
  stock("ENEV3",  "Eneva S.A.",                                          "Eneva",          "Energia Elétrica",       "Geração Termelétrica",           CA,  false, true),
  stock("CMIG4",  "Cemig – Companhia Energética de Minas Gerais",        "CEMIG PN",       "Energia Elétrica",       "Geração e Distribuição",         CA,  false, true),
  stock("CMIG3",  "Cemig – Companhia Energética de Minas Gerais",        "CEMIG ON",       "Energia Elétrica",       "Geração e Distribuição",         CA,  false, true),
  stock("CPLE6",  "Copel – Companhia Paranaense de Energia",             "Copel PNB",      "Energia Elétrica",       "Geração e Distribuição",         CA,  false, true),
  stock("CPLE3",  "Copel – Companhia Paranaense de Energia",             "Copel ON",       "Energia Elétrica",       "Geração e Distribuição",         CA,  false, true),
  stock("ALUP11", "Alupar Investimento S.A.",                            "Alupar",         "Energia Elétrica",       "Transmissão de Energia",         CA,  false, true,  "unit"),
  stock("TAEE11", "Taesa – Transmissora Aliança de Energia Elétrica S.A.", "Taesa",        "Energia Elétrica",       "Transmissão de Energia",         QO, false, false, "unit"),
  stock("TRPL4",  "CTEEP – Cia. de Transmissão de Energia Elétrica Paulista", "ISA CTEEP","Energia Elétrica",       "Transmissão de Energia",         QO),
  stock("AURE3",  "Auren Energia S.A.",                                  "Auren Energia",  "Energia Elétrica",       "Geração de Energia",             QO),
  stock("CESP6",  "CESP – Companhia Energética de São Paulo",            "CESP",           "Energia Elétrica",       "Geração de Energia",             QO),
  stock("ENBR3",  "EDP Brasil S.A.",                                     "EDP Brasil",     "Energia Elétrica",       "Distribuição de Energia",        QO),
  stock("ENGI11", "Energisa S.A.",                                       "Energisa",       "Energia Elétrica",       "Distribuição de Energia",        QO, false, false, "unit"),
  stock("CGAS3",  "Comgás – Companhia de Gás de São Paulo",              "Comgás",         "Energia Elétrica",       "Distribuição de Gás",            QO),

  // ── Saneamento ───────────────────────────────────────────────────────────────
  stock("SBSP3",  "Sabesp – Cia. de Saneamento Básico do Estado de SP",  "Sabesp",         "Saneamento",             "Água e Esgoto",                  CVM, false, true),
  stock("CSMG3",  "Copasa – Companhia de Saneamento de Minas Gerais",    "Copasa",         "Saneamento",             "Água e Esgoto",                  QO),
  stock("SAPR11", "Sanepar – Companhia de Saneamento do Paraná",         "Sanepar",        "Saneamento",             "Água e Esgoto",                  QO, false, false, "unit"),

  // ── Telecomunicações ─────────────────────────────────────────────────────────
  stock("VIVT3",  "Telefônica Brasil S.A.",                              "Vivo",           "Telecomunicações",       "Telefonia Fixa e Móvel",         FA,  true,  true),
  stock("TIMS3",  "TIM S.A.",                                            "TIM",            "Telecomunicações",       "Telefonia Móvel",                CVM, false, true),

  // ── Bebidas ──────────────────────────────────────────────────────────────────
  stock("ABEV3",  "Ambev S.A.",                                          "Ambev",          "Bebidas",                "Cervejas e Bebidas",             FA,  true,  true),

  // ── Alimentos ────────────────────────────────────────────────────────────────
  stock("BRFS3",  "BRF S.A.",                                            "BRF",            "Alimentos",              "Carnes e Derivados",             QO),
  stock("JBSS3",  "JBS S.A.",                                            "JBS",            "Alimentos",              "Carnes e Derivados",             QO),
  stock("MRFG3",  "Marfrig Global Foods S.A.",                           "Marfrig",        "Alimentos",              "Carnes e Derivados",             QO),
  stock("BEEF3",  "Minerva Foods S.A.",                                  "Minerva",        "Alimentos",              "Carnes e Derivados",             QO),
  stock("SMTO3",  "São Martinho S.A.",                                   "São Martinho",   "Alimentos",              "Açúcar e Álcool",                QO),
  stock("MDIA3",  "M. Dias Branco S.A.",                                 "M. Dias Branco", "Alimentos",              "Massas e Biscoitos",             QO),
  stock("SLCE3",  "SLC Agrícola S.A.",                                   "SLC Agrícola",   "Alimentos",              "Agropecuária",                   QO),
  stock("AGRO3",  "BrasilAgro – Cia. Brasileira de Propriedades Agrícolas", "BrasilAgro", "Alimentos",              "Agropecuária",                   QO),

  // ── Transporte e Logística ───────────────────────────────────────────────────
  stock("RENT3",  "Localiza Rent a Car S.A.",                            "Localiza",       "Transporte",             "Locação de Veículos",            CA,  false, true),
  stock("RAIL3",  "Rumo S.A.",                                           "Rumo",           "Transporte",             "Transporte Ferroviário",         CA,  false, true),
  stock("MOVI3",  "Movida Participações S.A.",                           "Movida",         "Transporte",             "Locação de Veículos",            QO),
  stock("TGMA3",  "Tegma Gestão Logística S.A.",                         "Tegma",          "Transporte",             "Logística Rodoviária",           QO),
  stock("SIMH3",  "Simpar S.A.",                                         "Simpar",         "Transporte",             "Locação e Logística",            QO),
  stock("VAMO3",  "Vamos Locações S.A.",                                 "Vamos",          "Transporte",             "Locação de Veículos",            QO),
  stock("AZUL4",  "Azul S.A.",                                           "Azul",           "Transporte",             "Aviação Regional",               QO),
  stock("GOLL4",  "Gol Linhas Aéreas Inteligentes S.A.",                 "GOL",            "Transporte",             "Aviação",                        QO),
  stock("LOGN3",  "Log-In Logística Intermodal S.A.",                    "Log-In",         "Transporte",             "Logística Portuária",            QO),
  stock("STBP3",  "Santos Brasil Participações S.A.",                    "Santos Brasil",  "Transporte",             "Portuário",                      QO),
  stock("SEQL3",  "Sequoia Logística e Transportes S.A.",                "Sequoia",        "Transporte",             "Logística",                      QO),

  // ── Varejo ───────────────────────────────────────────────────────────────────
  stock("LREN3",  "Lojas Renner S.A.",                                   "Renner",         "Varejo",                 "Vestuário",                      CA,  false, true),
  stock("ASAI3",  "Assaí Atacadista S.A.",                               "Assaí",          "Varejo",                 "Atacado Alimentar",              CVM, false, true),
  stock("MGLU3",  "Magazine Luiza S.A.",                                 "Magalu",         "Varejo",                 "Varejo Eletroeletrônico",        QO),
  stock("PCAR3",  "Grupo Pão de Açúcar S.A.",                            "GPA",            "Varejo",                 "Supermercados",                  QO),
  stock("CRFB3",  "Atacadão S.A.",                                       "Carrefour Brasil","Varejo",                "Hipermercados",                  QO),
  stock("SOMA3",  "Grupo Soma S.A.",                                     "Grupo Soma",     "Varejo",                 "Vestuário e Moda",               QO),
  stock("SBFG3",  "SBF Group S.A.",                                      "SBF / Centauro", "Varejo",                 "Artigos Esportivos",             QO),
  stock("ARZZ3",  "Arezzo Indústria e Comércio S.A.",                    "Arezzo",         "Varejo",                 "Calçados e Acessórios",          QO),
  stock("GRND3",  "Grendene S.A.",                                       "Grendene",       "Varejo",                 "Calçados",                       QO),
  stock("VULC3",  "Vulcabras S.A.",                                      "Vulcabras",      "Varejo",                 "Calçados",                       QO),
  stock("PETZ3",  "Petz S.A.",                                           "Petz",           "Varejo",                 "Pet e Animais",                  QO),
  stock("GMAT3",  "Grupo Mateus S.A.",                                   "Grupo Mateus",   "Varejo",                 "Supermercados",                  QO),
  stock("VVAR3",  "Casas Bahia S.A.",                                    "Casas Bahia",    "Varejo",                 "Varejo Eletroeletrônico",        QO),
  stock("ALPA4",  "Alpargatas S.A.",                                     "Alpargatas",     "Varejo",                 "Calçados e Acessórios",          QO),
  stock("LJQQ3",  "Quero-Quero S.A.",                                    "Quero-Quero",    "Varejo",                 "Materiais de Construção",        QO),
  stock("PTBL3",  "Portobello S.A.",                                     "Portobello",     "Varejo",                 "Revestimentos Cerâmicos",        QO),

  // ── Construção Civil ─────────────────────────────────────────────────────────
  stock("CYRE3",  "Cyrela Brazil Realty S.A.",                           "Cyrela",         "Construção Civil",       "Incorporação Imobiliária",       QO),
  stock("MRVE3",  "MRV Engenharia e Participações S.A.",                 "MRV",            "Construção Civil",       "Incorporação Imobiliária",       QO),
  stock("CURY3",  "Cury Construtora e Incorporadora S.A.",               "Cury",           "Construção Civil",       "Incorporação Imobiliária",       QO),
  stock("PLPL3",  "Plano & Plano Desenvolvimento Imobiliário S.A.",      "Plano&Plano",    "Construção Civil",       "Incorporação Imobiliária",       QO),
  stock("EVEN3",  "Even Construtora e Incorporadora S.A.",               "Even",           "Construção Civil",       "Incorporação Imobiliária",       QO),
  stock("DIRR3",  "Direcional Engenharia S.A.",                          "Direcional",     "Construção Civil",       "Incorporação Imobiliária",       QO),
  stock("TEND3",  "Construtora Tenda S.A.",                              "Tenda",          "Construção Civil",       "Incorporação Imobiliária",       QO),
  stock("GFSA3",  "Gafisa S.A.",                                         "Gafisa",         "Construção Civil",       "Incorporação Imobiliária",       QO),
  stock("MTRE3",  "Mitre Realty Empreendimentos e Participações S.A.",   "Mitre Realty",   "Construção Civil",       "Incorporação Imobiliária",       QO),

  // ── Imóveis Comerciais ───────────────────────────────────────────────────────
  stock("MULT3",  "Multiplan Empreendimentos Imobiliários S.A.",         "Multiplan",      "Imóveis Comerciais",     "Shopping Centers",               QO),
  stock("ALOS3",  "Allos S.A.",                                          "Allos",          "Imóveis Comerciais",     "Shopping Centers",               QO),
  stock("IGTI11", "Iguatemi S.A.",                                       "Iguatemi",       "Imóveis Comerciais",     "Shopping Centers",               QO, false, false, "unit"),
  stock("JHSF3",  "JHSF Participações S.A.",                             "JHSF",           "Imóveis Comerciais",     "Shopping e Real Estate",         QO),
  stock("BRPR3",  "BR Properties S.A.",                                  "BR Properties",  "Imóveis Comerciais",     "Escritórios e Galpões",          QO),

  // ── Bancário ─────────────────────────────────────────────────────────────────
  stock("ITUB4",  "Itaú Unibanco Holding S.A.",                          "Itaú Unibanco",  "Bancário",               "Banco Múltiplo",                 SS),
  stock("ITUB3",  "Itaú Unibanco Holding S.A.",                          "Itaú ON",        "Bancário",               "Banco Múltiplo",                 SS),
  stock("BBDC4",  "Banco Bradesco S.A.",                                  "Bradesco",       "Bancário",               "Banco Múltiplo",                 SS),
  stock("BBDC3",  "Banco Bradesco S.A.",                                  "Bradesco ON",    "Bancário",               "Banco Múltiplo",                 SS),
  stock("BBAS3",  "Banco do Brasil S.A.",                                 "Banco do Brasil","Bancário",               "Banco Público",                  SS),
  stock("BPAC11", "BTG Pactual S.A.",                                    "BTG Pactual",    "Bancário",               "Banco de Investimento",          SS, false, false, "unit"),
  stock("SANB11", "Banco Santander Brasil S.A.",                         "Santander BR",   "Bancário",               "Banco Múltiplo",                 SS, false, false, "unit"),
  stock("BRSR6",  "Banrisul – Banco do Estado do Rio Grande do Sul S.A.","Banrisul",       "Bancário",               "Banco Estadual",                 SS),

  // ── Financeiro ───────────────────────────────────────────────────────────────
  stock("B3SA3",  "B3 S.A. – Brasil, Bolsa, Balcão",                    "B3",             "Financeiro",             "Infraestrutura de Mercado",      QO),

  // ── Seguros ──────────────────────────────────────────────────────────────────
  stock("BBSE3",  "BB Seguridade Participações S.A.",                    "BB Seguridade",  "Seguros",                "Seguro Bancário",                SS),
  stock("PSSA3",  "Porto Seguro S.A.",                                   "Porto Seguro",   "Seguros",                "Seguro Diversificado",           SS),
  stock("SULA11", "SulAmérica S.A.",                                     "SulAmérica",     "Seguros",                "Seguro Saúde e Vida",            SS, false, false, "unit"),
  stock("IRBR3",  "IRB Brasil RE S.A.",                                  "IRB Brasil",     "Seguros",                "Resseguro",                      SS),
  stock("CXSE3",  "Caixa Seguridade Participações S.A.",                 "Caixa Seguridade","Seguros",               "Seguro Bancário",                SS),

  // ── Holdings Financeiras ─────────────────────────────────────────────────────
  stock("ITSA4",  "Itaúsa S.A.",                                         "Itaúsa",         "Holding Financeira",     "Holding Bancária",               SS),
  stock("ITSA3",  "Itaúsa S.A.",                                         "Itaúsa ON",      "Holding Financeira",     "Holding Bancária",               SS),

  // ── Saúde ────────────────────────────────────────────────────────────────────
  stock("HAPV3",  "Hapvida Participações e Investimentos S.A.",          "Hapvida",        "Saúde",                  "Planos de Saúde",                QO),
  stock("RDOR3",  "Rede D'Or São Luiz S.A.",                            "Rede D'Or",      "Saúde",                  "Hospitais",                      QO),
  stock("RADL3",  "Raia Drogasil S.A.",                                  "RD Saúde",       "Saúde",                  "Farmácias e Drogarias",          CA,  false, true),
  stock("HYPE3",  "Hypera S.A.",                                         "Hypera Pharma",  "Saúde",                  "Medicamentos",                   CA,  false, true),
  stock("FLRY3",  "Fleury S.A.",                                         "Fleury",         "Saúde",                  "Diagnósticos",                   QO),
  stock("ODPV3",  "Odontoprev S.A.",                                     "Odontoprev",     "Saúde",                  "Planos Odontológicos",           QO),
  stock("QUAL3",  "Qualicorp Consultoria e Corretora de Benefícios S.A.","Qualicorp",      "Saúde",                  "Benefícios Corporativos",        QO),
  stock("BLAU3",  "Blau Farmacêutica S.A.",                              "Blau Farma",     "Saúde",                  "Medicamentos",                   QO),

  // ── Educação ─────────────────────────────────────────────────────────────────
  stock("COGN3",  "Cogna Educação S.A.",                                 "Cogna",          "Educação",               "Ensino Superior",                QO),
  stock("YDUQ3",  "Yduqs Participações S.A.",                            "Yduqs",          "Educação",               "Ensino Superior",                QO),
  stock("SEER3",  "Ser Educacional S.A.",                                "Ser Educacional","Educação",               "Ensino Superior",                QO),
  stock("CSED3",  "Cruzeiro do Sul Educacional S.A.",                    "Cruzeiro do Sul","Educação",               "Ensino Superior",                QO),
  stock("ANIM3",  "Ânima Educação S.A.",                                 "Ânima",          "Educação",               "Ensino Superior",                QO),

  // ── Consumo Pessoal e Serviços ───────────────────────────────────────────────
  stock("NTCO3",  "Natura & Co Holding S.A.",                            "Natura &Co",     "Consumo Pessoal",        "Cosméticos e Higiene",           QO),
  stock("SMFT3",  "SmartFit Escola de Ginástica e Dança S.A.",           "SmartFit",       "Consumo Pessoal",        "Academias e Fitness",            QO),
  stock("AMBP3",  "Ambipar Participações e Franquias S.A.",              "Ambipar",        "Serviços",               "Gestão Ambiental",               QO),
  stock("CVCB3",  "CVC Brasil Operadora e Agência de Viagens S.A.",      "CVC",            "Serviços",               "Turismo e Viagens",              QO),
  stock("VLID3",  "Valid Soluções S.A.",                                  "Valid",          "Serviços",               "Documentos e Soluções Digitais", QO),
  stock("PRNR3",  "Priner Serviços Industriais S.A.",                    "Priner",         "Serviços",               "Serviços Industriais",           QO),

  // ── Tecnologia ───────────────────────────────────────────────────────────────
  stock("TOTS3",  "Totvs S.A.",                                          "Totvs",          "Tecnologia",             "Software Empresarial",           QO),
  stock("INTB3",  "Intelbras S.A.",                                      "Intelbras",      "Tecnologia",             "Telec. Eletrônica",              QO),
  stock("LWSA3",  "Locaweb Serviços de Internet S.A.",                   "Locaweb",        "Tecnologia",             "Hospedagem e SaaS",              QO),
  stock("CASH3",  "Méliuz S.A.",                                         "Méliuz",         "Tecnologia",             "Fintech e Cashback",             QO),
  stock("POSI3",  "Positivo Tecnologia S.A.",                            "Positivo",       "Tecnologia",             "Hardware e Dispositivos",        QO),

  // ── FIIs (sector_specific_model_required) ─────────────────────────────────────
  stock("MXRF11", "Maxi Renda FII",                                      "MXRF11",         "FII",                    "Papel (CRI/CRA)",                SS, false, false, "fii"),
  stock("XPML11", "XP Malls FII",                                        "XPML11",         "FII",                    "Shopping Centers",               SS, false, false, "fii"),
  stock("HGLG11", "CSHG Logística FII",                                  "HGLG11",         "FII",                    "Logística e Galpões",            SS, false, false, "fii"),
  stock("KNRI11", "Kinea Renda Imobiliária FII",                         "KNRI11",         "FII",                    "Híbrido",                        SS, false, false, "fii"),
  stock("VISC11", "Vinci Shopping Centers FII",                          "VISC11",         "FII",                    "Shopping Centers",               SS, false, false, "fii"),
  stock("BCFF11", "BTG Pactual Fundo de Fundos FII",                     "BCFF11",         "FII",                    "Fundo de Fundos",                SS, false, false, "fii"),
  stock("IRDM11", "Iridium Recebíveis Imobiliários FII",                 "IRDM11",         "FII",                    "Papel (CRI)",                    SS, false, false, "fii"),
  stock("KNCR11", "Kinea CRI Imobiliários FII",                          "KNCR11",         "FII",                    "Papel (CRI)",                    SS, false, false, "fii"),

  // ── ETFs (sector_specific_model_required) ─────────────────────────────────────
  stock("BOVA11", "iShares Ibovespa FI Ações",                           "BOVA11",         "ETF",                    "Índice Ibovespa",                SS, false, false, "etf"),
  stock("IVVB11", "iShares S&P 500 FI Ações",                            "IVVB11",         "ETF",                    "Índice S&P 500",                 SS, false, false, "etf"),
  stock("SMAL11", "iShares Small Cap FI Ações",                          "SMAL11",         "ETF",                    "Small Caps Brasil",              SS, false, false, "etf"),
  stock("HASH11", "Hashdex Nasdaq Crypto Index FI Ações",                "HASH11",         "ETF",                    "Criptoativos",                   SS, false, false, "etf"),
  stock("SPXI11", "iShares S&P 500 BRL FI Ações",                        "SPXI11",         "ETF",                    "Índice S&P 500 (BRL)",           SS, false, false, "etf"),
  stock("GOLD11", "Trend ETF Ouro FI Ações",                             "GOLD11",         "ETF",                    "Commodities – Ouro",             SS, false, false, "etf"),
];
