# Coverage Audit — Quote-Only e Cobertura Incompleta

_Gerado em 2026-11-02 por `npm run coverage:audit:quote-only`._

## Resumo

| Categoria | Total |
|---|---|
| Candidato mapeamento CVM | 10 |
| Modelo setorial pendente | 34 |
| Manter quote-only | 4 |
| Marcar descontinuado | 8 |
| Mismatch cache/status | 0 |

## Candidatos a Mapeamento CVM

Empresas operacionais com `quote_only` que provavelmente têm CNPJ ativo na CVM e poderiam ser incluídas no pipeline de dados.

| Ticker | Empresa | Setor | Notas |
|---|---|---|---|
| VAMO3 | Vamos Locações S.A. | Transporte | — |
| LOGN3 | Log-In Logística Intermodal S.A. | Transporte | — |
| SEQL3 | Sequoia Logística e Transportes S.A. | Transporte | — |
| LJQQ3 | Quero-Quero S.A. | Varejo | — |
| PTBL3 | Portobello S.A. | Varejo | — |
| PLPL3 | Plano & Plano Desenvolvimento Imobiliário S.A. | Construção Civil | — |
| ALOS3 | Allos S.A. | Imóveis Comerciais | — |
| AMBP3 | Ambipar Participações e Franquias S.A. | Serviços | — |
| PRNR3 | Priner Serviços Industriais S.A. | Serviços | — |
| CASH3 | Méliuz S.A. | Tecnologia | — |

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

Entidade CVM CANCELADA no registro ou código de negociação obsoleto. Recomendação: `coverageStatus` = `"unavailable"`.

- **RRRP3** — 3R Petroleum Óleo e Gás S.A. (status atual: `unavailable`)
- **GOLL4** — Gol Linhas Aéreas Inteligentes S.A. (status atual: `unavailable`)
- **CRFB3** — Atacadão S.A. (status atual: `unavailable`)
- **SOMA3** — Grupo Soma S.A. (status atual: `unavailable`)
- **PETZ3** — Petz S.A. (status atual: `unavailable`)
- **VVAR3** — Casas Bahia S.A. (status atual: `unavailable`)
- **BRPR3** — BR Properties S.A. (status atual: `unavailable`)
- **SULA11** — SulAmérica S.A. (status atual: `unavailable`)

## Manter Quote-Only

Holdings financeiras ou estruturas sem modelo industrial aplicável.

- **BRAP4** — Bradespar S.A. (Mineração)
- **B3SA3** — B3 S.A. – Brasil, Bolsa, Balcão (Financeiro)
- **ITSA4** — Itaúsa S.A. (Holding Financeira)
- **ITSA3** — Itaúsa S.A. (Holding Financeira)

---
_Para atualizar: `npm run coverage:audit:quote-only`_

<!-- manual-sections: preserved by coverage:audit:quote-only -->

## Round 1 — Mapeamento CVM de tickers quote-only (2026-11-02)

> A versão anterior deste documento (gerada em 2026-05-21) estava desatualizada e **não** foi usada como fonte.
> Todos os candidatos foram re-verificados em 2026-11-02 contra:
> - `cad_cia_aberta.csv` (registro CVM: `SIT`, `CD_CVM`, `CNPJ_CIA`, `CATEG_REG`, `SIT_EMISSOR`, cancelamentos);
> - `fca_cia_aberta_valor_mobiliario_{2021,2024,2025,2026}.csv` (código de negociação × CNPJ, `Data_Fim_Negociacao`);
> - `getAnnualDfpFinancials` (pipeline DFP do projeto, anos 2020–2024) + `cvmAnalysisEligibilityReason`.

**quote_only:** 27 → 12 (−8 mapeados, −7 marcados `unavailable`).

### Mapeamentos VERIFIED (8)

Todos: `SIT=ATIVO`, Categoria A, `FASE OPERACIONAL`, ticker listado na FCA 2026 sob o mesmo CNPJ sem data fim, DFP 2020–2024 completo (5 anos), DFP 2025 entregue em 2026, elegível para `cvm_analysis`. Status no universo: `quote_only` → `cvm_analysis` (não `full_analysis`: sem mock data).

| Ticker | Razão social (CVM) | CD_CVM | CNPJ | Anos DFP | Trimestres ITR | Forecast |
|---|---|---|---|---|---|---|
| AERI3 | AERIS IND. E COM. DE EQUIP. PARA GER. DE ENG. S.A. | 25283 | 12.528.708/0001-07 | 5 | 25 | sim |
| RECV3 | PETRORECÔNCAVO S.A. | 25780 | 03.342.704/0001-30 | 5 | 21 | sim |
| SBFG3 | GRUPO SBF S.A. | 24694 | 13.217.485/0001-11 | 5 | 28 | sim |
| GMAT3 | GRUPO MATEUS S.A. | 25186 | 24.990.777/0001-09 | 5 | 25 | sim |
| BLAU3 | BLAU FARMACÊUTICA S.A. | 24627 | 58.430.828/0001-60 | 5 | 31 | sim |
| SMFT3 | SMARTFIT ESCOLA DE GINÁSTICA E DANÇA S.A. | 24260 | 07.594.978/0001-78 | 5 | 31 | sim |
| VLID3 | VALID SOLUÇÕES S.A. | 20028 | 33.113.309/0001-47 | 5 | 31 | sim |
| POSI3 | POSITIVO TECNOLOGIA S.A. | 20362 | 81.243.735/0001-48 | 5 | 31 | sim |

Nota SBFG3: usar a holding listada Grupo SBF (24694), **não** a subsidiária SBF Comércio (25410, Categoria B).

### Identidade verificada, adiada para Round 2 (MANUAL_REVIEW)

DFP 2020–2024 disponível e identidade CVM/FCA consistente, mas fora do lote por cautela:

| Ticker | CD_CVM | CNPJ | Motivo do adiamento |
|---|---|---|---|
| VAMO3 | 24716 | 23.373.000/0001-32 | Reorganização societária 2025 (segregação de concessionárias) — comparabilidade histórica a revisar |
| LOGN3 | 20710 | 42.278.291/0001-24 | Controlada pela MSC, free float reduzido — risco de fechamento de capital |
| PTBL3 | 13773 | 83.475.913/0001-91 | Razão social atual é PBG S/A (ex-Portobello); atualizar nomes no universo antes |
| ALOS3 | 22357 | 05.878.397/0001-32 | Shopping centers — confirmar adequação do modelo industrial (MULT3/IGTI11 já usam) |
| LJQQ3 | 25038 | 96.418.264/0218-02 | OK; CNPJ do registro é de filial (/0218) — confirmar antes de mapear |
| PLPL3 | 25070 | 24.230.275/0001-80 | OK — candidato forte para Round 2 |
| PRNR3 | 24236 | 18.593.815/0001-97 | OK — candidato forte para Round 2 |
| SEQL3 | 25160 | 01.599.101/0001-93 | `SIT_EMISSOR` alterado em 2025-06-04 após reestruturação — revisar |

### REJECTED para Round 1

| Ticker | Motivo |
|---|---|
| AMBP3 | Ambipar (CVM 24961) em recuperação judicial desde 2025-10-30; razão social alterada |
| CASH3 | Méliuz (CVM 25232): modelo de negócio fintech/tesouraria — modelo industrial inadequado |

### Tickers obsoletos / descontinuados (marcados `unavailable`)

| Ticker | Evidência | Substituto (não incluído neste round) |
|---|---|---|
| PETZ3 | FCA 2026: negociação encerrada em 2026-01-02; Pet Center (CVM 25089) CANCELADA 2026-05-14 | AUAU3 — União Pet Participações (CVM 27766) |
| RRRP3 | Ausente da FCA 2024+; mesmo CNPJ 12.091.809/0001-55 negocia como BRAV3 (Brava Energia, CVM 25291) | BRAV3 |
| VVAR3 | Ausente da FCA 2021+; CNPJ 33.041.260/0652-90 negociou VIIA3 → BHIA3 | BHIA3 — Grupo Casas Bahia (CVM 6505), **em RJ desde 2026-10-22** |
| GOLL4 | Gol (CVM 19569) CANCELADA 2026-04-01 — elisão por incorporação | — |
| CRFB3 | Atacadão (CVM 24171) CANCELADA 2025-12-22 — cancelamento voluntário | — |
| SOMA3 | Grupo Soma (CVM 25011) CANCELADA 2024-07-31 — incorporação (grupo atual: AZZA3) | — |
| BRPR3 | BR Properties (CVM 19925) CANCELADA 2023-12-20 — cancelamento voluntário | — |

Substitutos não foram adicionados ao `B3_UNIVERSE` neste round. AUAU3 tem histórico DFP curto (holding registrada em 2025); BHIA3 está em RJ.

### Caches gerados (apenas os 8 tickers)

- `src/data/cvm-cache/financials/<T>.json`, `src/data/cvm-cache/documents/<T>.json`
- `src/data/cvm-cache/quarterly/<T>.json`
- `src/data/forecast-cache/time-series/<T>.json`, `src/data/forecast-cache/baseline-forecasts/<T>.json`

Gerados com os novos filtros opcionais (`CVM_PRECOMPUTE_TICKERS`, `CVM_ITR_TICKERS`, `TIME_SERIES_PRECOMPUTE_TICKERS`, `FORECAST_PRECOMPUTE_TICKERS`); sem as variáveis, os scripts mantêm o comportamento padrão.

### Correções de consistência (pós-Round 1)

- `/api/coverage/<T>`: `coverageStatus: "unavailable"` declarado no `B3_UNIVERSE` agora é autoritativo
  (`resolveAssetCoverage` recebe `declaredStatus`; retorna `unavailable` / `DECLARED_UNAVAILABLE`).
  PETZ3, SULA11, RRRP3, VVAR3, GOLL4, CRFB3, SOMA3 e BRPR3 → `unavailable`. Ativos `quote_only` e modelos setoriais inalterados.
- Audit quote-only: arquivos de cache setorial com `available: false` (SULA11, BCFF11) são tratados como placeholders,
  não como cobertura de modelo — deixam de gerar casos suspeitos. Status declarado `unavailable` também é autoritativo no audit.
- Teste `model-cache-consistency.test.ts` garante que `CACHED_TICKERS` (banco/FII/seguro) contém exatamente os arquivos `available: true`.
