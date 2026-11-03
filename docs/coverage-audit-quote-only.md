# Coverage Audit — Quote-Only e Cobertura Incompleta

_Gerado em 2026-11-03 por `npm run coverage:audit:quote-only`._

## Resumo

| Categoria | Total |
|---|---|
| Candidato mapeamento CVM | 2 |
| Modelo setorial disponível | 20 |
| Camada informativa (ETF/BDR) | 14 |
| Modelo setorial pendente | 6 |
| Manter quote-only | 1 |
| Revisão manual | 4 |
| Marcar descontinuado | 24 |
| Mismatch cache/status | 0 |

## Candidatos a Mapeamento CVM

Empresas operacionais com `quote_only` que provavelmente têm CNPJ ativo na CVM e poderiam ser incluídas no pipeline de dados.

| Ticker | Empresa | Setor | Notas |
|---|---|---|---|
| BRAV3 | Brava Energia S.A. | Petróleo e Gás | — |
| AUAU3 | União Pet Participações S.A. | Varejo | — |

## Modelo Setorial Pendente

Ativos ativos que exigem um modelo ainda inexistente ou sem cache para este código. ETFs/BDRs (camada informativa) e ativos com modelo setorial disponível não entram aqui.

| Ticker | Empresa | Status | Tipo | Rota | Notas |
|---|---|---|---|---|---|
| BRAP4 | Bradespar S.A. | quote_only | preferred_stock | quote_only | Revisado: Bradespar is a pure holding whose main asset is a Vale stake — industrial DFP metrics do not describe it |
| ALOS3 | Allos S.A. | quote_only | common_stock | quote_only | Revisado: Shopping-center owner: needs NOI/FFO/NAV metrics; extracted DFP showed total debt = 0 and 2023 EBIT ≈ 2× revenue (combination gain) |
| B3SA3 | B3 S.A. – Brasil, Bolsa, Balcão | quote_only | financial | quote_only | Revisado: Exchange/clearing operator — revenue and balance sheet (collateral, clearing) need a market-infrastructure model |
| ITSA4 | Itaúsa S.A. | sector_specific_model_required | financial | sector_specific_pending | Revisado: Itaúsa is a holding (equity-accounted stakes in Itaú Unibanco and non-financial companies) — not a bank and not an operating company |
| ITSA3 | Itaúsa S.A. | sector_specific_model_required | financial | sector_specific_pending | Revisado: Itaúsa is a holding (equity-accounted stakes in Itaú Unibanco and non-financial companies) — not a bank and not an operating company |
| BTHF11 | BTG Pactual Real Estate Hedge Fund FII | sector_specific_model_required | fii | sector_specific_pending | — |

## Prováveis Descontinuados

Códigos históricos verificados (`TICKER_LIFECYCLE`): renomeados, convertidos, incorporados, deslistados ou cancelados.

- **EMBR3** — Embraer S.A. (status atual: `unavailable`)
- **RRRP3** — 3R Petroleum Óleo e Gás S.A. (status atual: `unavailable`)
- **ELET3** — Centrais Elétricas Brasileiras S.A. (status atual: `unavailable`)
- **ELET6** — Centrais Elétricas Brasileiras S.A. (status atual: `unavailable`)
- **CPLE6** — Copel – Companhia Paranaense de Energia (status atual: `unavailable`)
- **TRPL4** — CTEEP – Cia. de Transmissão de Energia Elétrica Paulista (status atual: `unavailable`)
- **CESP6** — CESP – Companhia Energética de São Paulo (status atual: `unavailable`)
- **ENBR3** — EDP Brasil S.A. (status atual: `unavailable`)
- **BRFS3** — BRF S.A. (status atual: `unavailable`)
- **JBSS3** — JBS S.A. (status atual: `unavailable`)
- **MRFG3** — Marfrig Global Foods S.A. (status atual: `unavailable`)
- **AZUL4** — Azul S.A. (status atual: `unavailable`)
- **GOLL4** — Gol Linhas Aéreas Inteligentes S.A. (status atual: `unavailable`)
- **STBP3** — Santos Brasil Participações S.A. (status atual: `unavailable`)
- **CRFB3** — Atacadão S.A. (status atual: `unavailable`)
- **SOMA3** — Grupo Soma S.A. (status atual: `unavailable`)
- **ARZZ3** — Arezzo Indústria e Comércio S.A. (status atual: `unavailable`)
- **PETZ3** — Petz S.A. (status atual: `unavailable`)
- **VVAR3** — Casas Bahia S.A. (status atual: `unavailable`)
- **BRPR3** — BR Properties S.A. (status atual: `unavailable`)
- **SULA11** — SulAmérica S.A. (status atual: `unavailable`)
- **ODPV3** — Odontoprev S.A. (status atual: `unavailable`)
- **NTCO3** — Natura & Co Holding S.A. (status atual: `unavailable`)
- **BCFF11** — BTG Pactual Fundo de Fundos FII (status atual: `unavailable`)

## Manter Quote-Only

Limitados por decisão metodológica (`READINESS_DECISIONS`) ou estruturas financeiras sem modelo aplicável.

- **CASH3** — Méliuz S.A. (Tecnologia) — Revisado: Business model pivoted to a Bitcoin treasury strategy (2025–2026) — industrial metrics would mislead

## Revisão Manual

Identidade CVM verificada, mas reestruturação societária ou adequação ao modelo industrial ainda pendente.

- **VAMO3** — Vamos Locações S.A. — Revisado: 2024 reorganisation (dealerships segregated into Automob/AMOB3) breaks 2020–2023 comparability; fleet purchases in operating cash flow distort industrial FCF
- **SEQL3** — Sequoia Logística e Transportes S.A. — Revisado: Extrajudicial recovery (2024), reverse splits, change of control and debt renegotiation (2026) — wait for stabilisation
- **BHIA3** — Grupo Casas Bahia S.A. — Revisado: Grupo Casas Bahia is in judicial recovery; no CVM cache under the current code yet (VVAR3/VIIA3 history not cached)
- **AMBP3** — Ambipar Participações e Franquias S.A. — Revisado: Judicial recovery (recuperação judicial) since 2025-10-30 — restructuring prevents normal model use

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

## Round 2 — Mapeamento CVM de tickers quote-only (2026-11-02)

> As notas do Round 1 **não** foram tomadas como verdade: todos os candidatos foram re-verificados com downloads novos de
> `cad_cia_aberta.csv`, `fca_cia_aberta_valor_mobiliario_2026.csv`, `ipe_cia_aberta_{2024,2025,2026}.csv` (fatos relevantes e
> reorganizações societárias), `dfp_cia_aberta_2024.csv` (CNPJ declarado no DFP) e o pipeline `getAnnualDfpFinancials`.
> Também foi feita uma checagem explícita de adequação ao modelo industrial e de qualidade dos dados extraídos.

**quote_only:** 12 → 7 (−5 mapeados). **Candidatos revisados:** 10 (todos os `quote_only` operacionais restantes).

### Mapeamentos VERIFIED (5)

Todos: `SIT=ATIVO`, Categoria A, `FASE OPERACIONAL`, ticker na FCA 2026 sob o mesmo CNPJ sem data fim, DFP 2020–2024 (5 anos),
elegível para `cvm_analysis`. Status no universo: `quote_only` → `cvm_analysis`.

| Ticker | Razão social (CVM) | CD_CVM | CNPJ | Trimestres ITR | Forecast | Observações |
|---|---|---|---|---|---|---|
| PLPL3 | PLANO & PLANO DESENVOLVIMENTO IMOBILIÁRIO S.A. | 25070 | 24.230.275/0001-80 | 25 | sim | Incorporadora — mesmo modelo de CYRE3/MRVE3/TEND3. Único fato 2026: novo acordo de acionistas |
| PRNR3 | PRINER SERVIÇOS INDUSTRIAIS S.A. | 24236 | 18.593.815/0001-97 | 31 | sim | Aquisições pequenas (SEMAR incorporada 2025, 60% SEMEP) e aumentos de capital privados; entidade inalterada |
| LOGN3 | LOG-IN LOGISTICA INTERMODAL S.A. | 20710 | 42.278.291/0001-24 | 31 | sim | Controlada pela MSC; nenhuma OPA/cancelamento de registro em IPE 2024–2026 |
| LJQQ3 | LOJAS QUERO QUERO S.A. | 25038 | 96.418.264/0218-02 | 25 | sim | CNPJ /0218 é o do emissor na CVM — idêntico em registro, FCA e DFP 2024. Varejo com braço de crédito próprio consolidado |
| PTBL3 | PBG S/A (ex-Portobello) | 13773 | 83.475.913/0001-91 | 31 | sim | Razão social atual PBG S/A, mesmo CNPJ/CD_CVM; nome no universo atualizado. Venda da unidade Pointer (2026-08) e reorganização com subsidiária integral (2026-05) não alteram o emissor |

Qualidade dos dados (todos os 5): receita positiva em todos os anos; nenhum valor anual/trimestral igual a zero ou ausente;
trimestres em ordem cronológica sem duplicatas; nenhum ponto de série temporal convertido de ausente para zero; 12 pontos
nulos por ticker (mesmo padrão de TUPY3). Trimestres ausentes são apenas Q4 de anos sem DFP no pipeline (2018, 2019, 2025) —
mantidos ausentes, não estimados.

### MANUAL_REVIEW (2) — permanecem `quote_only`

| Ticker | CD_CVM | Motivo |
|---|---|---|
| VAMO3 | 24716 | Reorganização estratégica consumada em 2024-11-30 (concessionárias segregadas para Automob/AMOB3) quebra a comparabilidade 2020–2023 vs 2024 (receita 6,1 → 4,7 bi). Compra de frota é classificada no FCO: FCF industrial ≈ −2,7 bi/ano com capex ≈ 0 — leitura enganosa no modelo atual |
| SEQL3 | 25160 | Recuperação extrajudicial homologada (2024-10), grupamentos de ações, mudança de controle (2026-02), transação com PGFN e repactuação de debêntures (2026). Prejuízos de −0,8/−1,3 bi em 2023/2024 — aguardar estabilização |

### Necessita modelo setorial

| Ticker | CD_CVM | Decisão |
|---|---|---|
| ALOS3 | 22357 | **Não mapeado.** Shopping centers exigem modelo imobiliário (NOI, FFO, NAV/cap rate, vacância). Além disso o DFP extraído é suspeito: dívida total = 0 em todos os anos (a companhia tem debêntures) e EBIT 2023 (5,4 bi) ≈ 2× receita (ganho da combinação Aliansce Sonae/brMalls). Candidato a um futuro modelo `real_estate`. Obs.: MULT3/IGTI11 já usam o modelo industrial — revisar junto com esse modelo |

### REJECTED (2) — permanecem `quote_only`

| Ticker | Motivo |
|---|---|
| AMBP3 | Ambipar (CVM 24961) em recuperação judicial desde 2025-10-30 |
| CASH3 | Méliuz (CVM 25232): fatos relevantes 2025–2026 confirmam estratégia de tesouraria em Bitcoin — modelo industrial inadequado |

### Classificação dos 7 `quote_only` restantes

| Ticker | Classe | Motivo |
|---|---|---|
| VAMO3 | manual_review | Reorganização 2024 / FCF distorcido |
| SEQL3 | manual_review | Reestruturação em curso |
| ALOS3 | needs_sector_specific_model | Imobiliário (shopping centers) |
| AMBP3 | keep_quote_only | Recuperação judicial |
| CASH3 | keep_quote_only | Tesouraria em Bitcoin |
| BRAP4 | keep_quote_only | Holding pura (participação na Vale) |
| B3SA3 | keep_quote_only | Infraestrutura de mercado financeiro — sem modelo industrial aplicável |

Essas decisões estão codificadas em `REVIEW_DECISIONS` em `scripts/audit-quote-only-coverage.ts` (nova ação `manual_review`),
para que o audit não volte a listá-los como candidatos genéricos.

### Caches gerados (apenas os 5 tickers)

`cvm-cache/financials`, `cvm-cache/documents`, `cvm-cache/quarterly`, `forecast-cache/time-series`,
`forecast-cache/baseline-forecasts` — 25 arquivos novos, nenhum arquivo de cache existente modificado.
