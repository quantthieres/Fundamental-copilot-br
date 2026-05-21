# Coverage Audit — Quote-Only e Cobertura Incompleta

_Gerado em 2026-05-21 por `npm run coverage:audit:quote-only`._

## Resumo

| Categoria | Total |
|---|---|
| Candidato mapeamento CVM | 21 |
| Modelo setorial pendente | 35 |
| Manter quote-only | 4 |
| Marcar descontinuado | 4 |
| Mismatch cache/status | 0 |

## Casos Suspeitos

- **GOLL4**: Known CANCELADA CVM entity still listed as "quote_only"
- **CRFB3**: Known CANCELADA CVM entity still listed as "quote_only"
- **SOMA3**: Known CANCELADA CVM entity still listed as "quote_only"
- **BRPR3**: Known CANCELADA CVM entity still listed as "quote_only"
- **SULA11**: Insurance cache file on disk not registered in insurance-coverage.ts
- **BCFF11**: FII cache file on disk not registered in fii-coverage.ts CACHED_TICKERS set

## Candidatos a Mapeamento CVM

Empresas operacionais com `quote_only` que provavelmente têm CNPJ ativo na CVM e poderiam ser incluídas no pipeline de dados.

| Ticker | Empresa | Setor | Notas |
|---|---|---|---|
| AERI3 | Aeris Energy S.A. | Bens de Capital | — |
| RECV3 | PetroRecôncavo S.A. | Petróleo e Gás | — |
| RRRP3 | 3R Petroleum Óleo e Gás S.A. | Petróleo e Gás | — |
| VAMO3 | Vamos Locações S.A. | Transporte | — |
| LOGN3 | Log-In Logística Intermodal S.A. | Transporte | — |
| SEQL3 | Sequoia Logística e Transportes S.A. | Transporte | — |
| SBFG3 | SBF Group S.A. | Varejo | — |
| PETZ3 | Petz S.A. | Varejo | — |
| GMAT3 | Grupo Mateus S.A. | Varejo | — |
| VVAR3 | Casas Bahia S.A. | Varejo | — |
| LJQQ3 | Quero-Quero S.A. | Varejo | — |
| PTBL3 | Portobello S.A. | Varejo | — |
| PLPL3 | Plano & Plano Desenvolvimento Imobiliário S.A. | Construção Civil | — |
| ALOS3 | Allos S.A. | Imóveis Comerciais | — |
| BLAU3 | Blau Farmacêutica S.A. | Saúde | — |
| SMFT3 | SmartFit Escola de Ginástica e Dança S.A. | Consumo Pessoal | — |
| AMBP3 | Ambipar Participações e Franquias S.A. | Serviços | — |
| VLID3 | Valid Soluções S.A. | Serviços | — |
| PRNR3 | Priner Serviços Industriais S.A. | Serviços | — |
| CASH3 | Méliuz S.A. | Tecnologia | — |
| POSI3 | Positivo Tecnologia S.A. | Tecnologia | — |

## Modelo Setorial Pendente

Ativos com `sector_specific_model_required` sem cache de modelo implementado.

| Ticker | Empresa | Tipo | Rota |
|---|---|---|---|
| ITUB4 | Itaú Unibanco Holding S.A. | bank | bank |
| ITUB3 | Itaú Unibanco Holding S.A. | bank | sector_specific_pending |
| BBDC4 | Banco Bradesco S.A. | bank | bank |
| BBDC3 | Banco Bradesco S.A. | bank | sector_specific_pending |
| BBAS3 | Banco do Brasil S.A. | bank | bank |
| BPAC11 | BTG Pactual S.A. | bank | bank |
| SANB11 | Banco Santander Brasil S.A. | bank | bank |
| BRSR6 | Banrisul – Banco do Estado do Rio Grande do Sul S.A. | bank | bank |
| BBSE3 | BB Seguridade Participações S.A. | insurance | insurance |
| PSSA3 | Porto Seguro S.A. | insurance | insurance |
| SULA11 | SulAmérica S.A. | insurance | unavailable |
| IRBR3 | IRB Brasil RE S.A. | insurance | insurance |
| CXSE3 | Caixa Seguridade Participações S.A. | insurance | insurance |
| MXRF11 | Maxi Renda FII | fii | fii |
| XPML11 | XP Malls FII | fii | fii |
| HGLG11 | CSHG Logística FII | fii | fii |
| KNRI11 | Kinea Renda Imobiliária FII | fii | fii |
| VISC11 | Vinci Shopping Centers FII | fii | fii |
| BCFF11 | BTG Pactual Fundo de Fundos FII | fii | sector_specific_pending |
| IRDM11 | Iridium Recebíveis Imobiliários FII | fii | fii |
| KNCR11 | Kinea CRI Imobiliários FII | fii | fii |
| HGRE11 | CSHG Real Estate FII | fii | fii |
| BOVA11 | iShares Ibovespa FI Ações | etf | informational_instrument |
| IVVB11 | iShares S&P 500 FI Ações | etf | informational_instrument |
| SMAL11 | iShares Small Cap FI Ações | etf | informational_instrument |
| HASH11 | Hashdex Nasdaq Crypto Index FI Ações | etf | informational_instrument |
| SPXI11 | iShares S&P 500 BRL FI Ações | etf | informational_instrument |
| GOLD11 | Trend ETF Ouro FI Ações | etf | informational_instrument |
| AAPL34 | Apple Inc. | bdr | informational_instrument |
| MSFT34 | Microsoft Corporation | bdr | informational_instrument |
| TSLA34 | Tesla Inc. | bdr | informational_instrument |
| AMZO34 | Amazon.com Inc. | bdr | informational_instrument |
| GOGL34 | Alphabet Inc. (Google) | bdr | informational_instrument |
| NVDC34 | NVIDIA Corporation | bdr | informational_instrument |
| GOOGL34 | Alphabet Inc. (Google) | bdr | informational_instrument |

## Prováveis Descontinuados

Entidade CVM CANCELADA no registro. Recomendação: atualizar `coverageStatus` para `"unavailable"`.

- **GOLL4** — Gol Linhas Aéreas Inteligentes S.A.
- **CRFB3** — Atacadão S.A.
- **SOMA3** — Grupo Soma S.A.
- **BRPR3** — BR Properties S.A.

## Manter Quote-Only

Holdings financeiras ou estruturas sem modelo industrial aplicável.

- **BRAP4** — Bradespar S.A. (Mineração)
- **B3SA3** — B3 S.A. – Brasil, Bolsa, Balcão (Financeiro)
- **ITSA4** — Itaúsa S.A. (Holding Financeira)
- **ITSA3** — Itaúsa S.A. (Holding Financeira)

---
_Para atualizar: `npm run coverage:audit:quote-only`_
