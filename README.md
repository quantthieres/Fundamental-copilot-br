<div align="center">

<pre align="center">
█▀▀ █ █ █▄ █ █▀▄ ▄▀█ █▀▄▀█ █▀▀ █▄ █ ▀█▀ ▄▀█ █     █▀▀ █▀█ █▀█ █ █   █▀█ ▀█▀
█▀  █▄█ █ ▀█ █▄▀ █▀█ █ ▀ █ ██▄ █ ▀█  █  █▀█ █▄▄   █▄▄ █▄█ █▀▀ █ █▄▄ █▄█  █ 
</pre>

<img src="./public/logo/logo-icon.svg" width="80"/>

</div>

<p align="center">
  Plataforma web para análise fundamentalista automatizada de empresas brasileiras listadas na B3.
</p>

<p align="center">
  Dados CVM • Indicadores financeiros • Métricas de mercado • Diagnóstico fundamentalista • Documentos oficiais
</p>

---

## Visão geral

O **Fundamental Copilot BR** é uma plataforma em desenvolvimento para organizar, padronizar e apresentar informações fundamentalistas de empresas brasileiras listadas na B3.

O objetivo é reduzir o trabalho manual de coleta e leitura de dados financeiros, oferecendo ao usuário uma visão clara de:

- demonstrações financeiras anuais (CVM / DFP consolidada);
- indicadores fundamentalistas calculados automaticamente;
- evolução histórica dos resultados;
- métricas de mercado via brapi;
- diagnóstico financeiro baseado em regras;
- documentos e eventos oficiais publicados na CVM.

> Projeto em desenvolvimento. As informações exibidas têm finalidade educacional e não constituem recomendação de investimento.

---

## Rotas principais

| Rota | Descrição |
|---|---|
| `/` | Landing page |
| `/dashboard?ticker=XXXX` | Dashboard de análise fundamentalista |
| `/cobertura` | Tabela de cobertura dos ativos da B3 |
| `/metodologia` | Metodologia e fontes de dados |
| `/sobre` | Informações sobre o projeto |
| `/relatorio/[ticker]` | Relatório imprimível por empresa |

---

## Posicionamento do produto

A plataforma não produz preço-alvo, recomendação de compra/venda ou estimativas automáticas de valor justo. O foco é apresentar dados financeiros, indicadores e sinais de atenção de forma transparente, padronizada e auditável.

---

## Funcionalidades atuais

- Busca por empresas brasileiras por ticker ou nome.
- Dashboard de análise fundamentalista com dois estágios de carregamento:
  - dados de mercado (brapi) exibidos imediatamente;
  - dados CVM carregados a partir do cache pré-computado em seguida.
- Integração com dados financeiros anuais da CVM (DFP consolidada).
- Integração opcional com cotações via brapi.
- Indicadores financeiros organizados por categoria (crescimento, margens, caixa, endividamento, mercado).
- Diagnóstico fundamentalista baseado em regras.
- Tabela histórica de demonstrações financeiras.
- Comparáveis por setor.
- Documentos oficiais CVM (DFP, ITR, FRE, Fatos Relevantes) com link para o visualizador oficial.
- Página de cobertura da B3.
- Página de metodologia.
- Página institucional "Sobre".
- Relatório imprimível de análise fundamentalista.
- Painel de projeções de fundamentos (ForecastPanel) com gráfico histórico + projeção, tabela de valores projetados, banda de incerteza heurística e resumo de retroteste walk-forward. As projeções são estimativas quantitativas de fundamentos, não recomendações de investimento. Sem preço-alvo, DCF ou valor justo.
- Diagnóstico de confiabilidade das projeções: nível (Alta/Média/Baixa/Insuficiente), score 0–100, razões em português e avisos de qualidade. Camada explicativa embutida no cache; não constitui recomendação de investimento.
- Testes automatizados com Vitest.
- Build e validação TypeScript.
- Camada informativa para ETFs e BDRs — sem análise fundamentalista corporativa (ver seção abaixo).

---

## ETFs e BDRs — camada informativa

ETFs (fundos de índice listados) e BDRs (recibos de ativos estrangeiros) não utilizam demonstrações financeiras corporativas comparáveis às de empresas operacionais brasileiras. Por isso, **não recebem análise fundamentalista industrial**, previsões, indicadores de valuation, ou qualquer linguagem de recomendação.

O dashboard exibe uma **tela informativa** dedicada para esses instrumentos com:

- Tipo do instrumento (ETF, BDR ou fundo listado).
- Breve descrição do instrumento e do ativo subjacente.
- Cotação de mercado via brapi (quando disponível).
- Explicação de por que a análise fundamentalista corporativa não se aplica.
- Aviso de que a tela é informativa e não constitui recomendação de investimento.

**Tickers suportados na camada informativa:**

| Tipo | Tickers                                         |
|------|-------------------------------------------------|
| ETF  | BOVA11, IVVB11, SMAL11, HASH11, SPXI11, GOLD11 |
| BDR  | AAPL34, MSFT34, TSLA34, AMZO34, GOGL34, NVDC34, GOOGL34 |

**O que NÃO é exibido para ETFs/BDRs:**
- Receita, EBIT, fluxo de caixa livre, margens.
- ROE, ROA, indicadores industriais.
- Painel de projeções (ForecastPanel).
- Indicadores de FII, banco ou seguradora.
- Preço-alvo, valor intrínseco, upside/downside, DCF, linguagem de compra/venda/manutenção.

**Roteamento de modelo:** ETFs e BDRs são roteados para `informational_instrument` em `src/lib/coverage/model-routing.ts` e não chegam ao pipeline industrial, bancário, de FII ou de seguradora.

---

## Principais módulos

### 1. Dados CVM

A camada `src/lib/cvm/` busca, processa e normaliza dados públicos da CVM.

O sistema trabalha com demonstrações financeiras anuais consolidadas extraídas dos arquivos DFP da CVM (dados.cvm.gov.br). Campos normalizados incluem receita, EBIT, lucro líquido, CFO, capex, FCL, caixa, dívida total e dívida líquida.

#### Cache pré-computado anual (DFP)

Para evitar downloads de ZIPs CVM (~13 MB por ano fiscal) a cada requisição, os dados são pré-computados e armazenados como JSON compacto:

```
src/data/cvm-cache/
  financials/   <TICKER>.json   — NormalizedFinancials[] por ano fiscal
  documents/    <TICKER>.json   — CvmDocument[] (documentos mais recentes)
```

Para regenerar o cache anual (cobre todos os 35 tickers com mapeamento CVM verificado):

```bash
npm run cvm:precompute
```

As rotas `/api/cvm/financials/[ticker]` e `/api/cvm/documents/[ticker]` servem o cache pré-computado em < 1 ms quando disponível, e caem no pipeline ao vivo como fallback.

#### Cache pré-computado trimestral (ITR)

O pipeline CVM ITR extrai dados trimestrais dos ZIPs ITR da CVM Dados Abertos e os armazena como JSON normalizado:

```
src/data/cvm-cache/
  quarterly/    <TICKER>.json   — QuarterlyFinancialRecord[] por trimestre
```

Os dados ITR passam por des-acumulação automática (os valores de DRE e DFC na CVM são YTD acumulados; o pipeline extrai os valores trimestrais reais). O Q4 é derivado como `DFP anual − ITR Q3 acumulado` quando os dados anuais estão disponíveis.

Para regenerar o cache trimestral:

```bash
npm run cvm:precompute:quarterly
```

A rota `/api/cvm/quarterly/[ticker]` serve o cache pré-computado quando disponível. Esta rota é infraestrutura para o Forecast Layer futuro e **não** é usada no dashboard atual.

> **Nota:** Os arquivos ZIP brutos da CVM são mantidos apenas em memória pelo servidor e nunca são gravados em disco — somente o JSON normalizado do cache é armazenado no repositório. O pipeline ITR é mais pesado que o DFP (~33 MB por ano vs ~13 MB); utilize a flag `CVM_ITR_START_YEAR` para limitar o intervalo de anos se necessário.

### 2. Dados de mercado

Cotações são obtidas via brapi.dev. A rota interna `/api/market-data/[ticker]` encapsula a requisição à brapi e retorna preço atual, variação diária e market cap quando disponíveis.

### 3. Indicadores fundamentalistas

Os indicadores são calculados em `src/lib/fundamentals/` a partir dos dados financeiros normalizados e, quando disponível, de dados de mercado.

Categorias atuais: crescimento, margens, geração de caixa, endividamento e métricas de mercado (P/L, EV/EBIT, EV/Receita, FCF Yield).

### 4. Diagnóstico fundamentalista

O diagnóstico é gerado por regras transparentes em `src/components/dashboard/FundamentalDiagnosis.tsx`, sem recomendação de investimento.

### 5. Documentos e eventos CVM

A seção de documentos exibe publicações oficiais da CVM com links diretos para o visualizador RAD/ENET. Os dados vêm dos catálogos CSV embutidos nos ZIPs DFP (compartilhados com o pipeline de financeiros) e do cache pré-computado.

### 6. Cobertura da B3

Cada ativo possui um status de cobertura (`src/data/b3-universe.ts`):

| Status | Rótulo | Descrição |
|---|---|---|
| `full_analysis` | Análise completa | Dashboard completo com dados financeiros, indicadores, diagnóstico e métricas de mercado. |
| `cvm_analysis` | Análise CVM | Análise fundamentalista gerada com dados CVM suficientes. |
| `cvm_financials` | Dados CVM | Dados CVM disponíveis, histórico ainda insuficiente para análise completa. |
| `quote_only` | Cotação | Cotação disponível; dados financeiros pendentes. |
| `sector_specific_model_required` | Modelo específico | Exige metodologia própria (bancos, seguradoras, FIIs, ETFs, BDRs). |
| `unavailable` | Em breve | Sem cobertura confiável ainda. |

Nem todo ativo B3 recebe o mesmo nível de análise. A plataforma degrada graciosamente em vez de aplicar métricas industriais inadequadas:

- **Bancos** (`sector_specific_model_required`) — camada bancária dedicada: extrai DFP anual via CVM com normalizador conservador (code-first + fallback por nome), calcula ROE, ROA, PL/Ativos, crescimento YoY e exibe painel bancário próprio no dashboard. Cache em `src/data/bank-cache/annual/`. Não usa indicadores industriais.
- **Seguradoras** (`sector_specific_model_required`) — camada de seguradora dedicada: extrai DFP anual consolidada (`DRE_con`, `BPA_con`, `BPP_con`) via CVM com normalizador próprio por correspondência de palavras-chave (prêmios ganhos, sinistros ocorridos, provisões técnicas). Calcula ROE, ROA, PL/Ativos, crescimento YoY e índice de sinistralidade (claimsRatio). Cache em `src/data/insurance-cache/annual/`. Não usa indicadores industriais (sem EBIT, FCL, receita, P/L). Seguradoras não são comparadas com empresas operacionais. Script: `npm run insurance:precompute`.
- **FIIs** (`sector_specific_model_required`) — camada de FII dedicada: extrai informe mensal via CVM (`dados/FII/DOC/INF_MENSAL/DADOS/`, ZIPs anuais), com CNPJ lookup por nome normalizado + mapa de overrides para fundos renomeados. Calcula patrimônio líquido, VP/cota, rendimentos mensais e DY/P×VP com cotação de mercado em tempo de renderização. Cache em `src/data/fii-cache/monthly/`. Não usa indicadores industriais (sem EBIT, FCL, receita). Script: `npm run fii:precompute`.
- **ETFs** — replicam índices e não possuem demonstrações financeiras corporativas próprias.
- **BDRs** — representam ativos estrangeiros e exigem tratamento regulatório específico.

### 7. Camada de cobertura B3 (`src/lib/coverage/`)

A camada de cobertura centraliza a classificação de ativos e a resolução do nível de análise disponível.

#### Tipos de ativo (`AssetType`)

| Tipo | Descrição |
|---|---|
| `common_stock` | Ação ordinária (ON) |
| `preferred_stock` | Ação preferencial (PN, PNA, PNB) |
| `unit` | Certificado de depósito de ação de empresa operacional |
| `bank` | Instituição bancária (inclui units de bancos como SANB11) |
| `insurance` | Seguradora |
| `financial` | Holding financeira ou infraestrutura de mercado |
| `fii` | Fundo de Investimento Imobiliário |
| `etf` | Exchange Traded Fund |
| `bdr` | Brazilian Depositary Receipt |
| `fund` | Outro fundo de investimento |
| `unknown` | Não classificado |

#### Classificador (`asset-classifier.ts`)

- Mapa explícito de tickers conhecidos (bancos, FIIs, ETFs, BDRs, units).
- Inferência por padrão de sufixo: 3 → `common_stock`, 4–8 → `preferred_stock`, 34 → `bdr`, 11 → `unit` (com refinamento por contexto).
- KLBN11, ALUP11, TAEE11, SAPR11 são units de empresas operacionais — não são FIIs.
- SANB11, BPAC11 são units bancárias — são classificados como `bank`, não como `unit`.

#### Resolutor de cobertura (`coverage-resolver.ts`)

Recebe disponibilidade de caches locais e retorna `AssetCoverageProfile` com:
- Nível de cobertura (`AnalysisCoverageLevel`)
- Código de razão (`CoverageReasonCode`)
- Mensagem de exibição em português
- Flags de elegibilidade (`isIndustrialModelEligible`, `isForecastEligible`)

#### API de cobertura

`GET /api/coverage/[ticker]` — retorna `AssetCoverageProfile` via verificação de existência de arquivos de cache. Somente leitura, não aciona pipelines CVM ao vivo.

#### Auditoria

```bash
npm run coverage:audit
```

Imprime resumo de cobertura para todos os tickers do universo B3: totais por tipo de ativo, nível de cobertura e código de razão. Não baixa dados.

---

## Forecast Layer — projeção de fundamentos

A plataforma conta com uma camada de previsão de fundamentos empresariais baseada em modelos de linha de base auditáveis, implementados inteiramente em TypeScript. Não há Python, não há dependências de ML, não há previsão de preços de ações.

> **As projeções são estimativas quantitativas de fundamentos, não recomendações de investimento.** Nenhum preço-alvo, DCF, valor justo, upside/downside ou sinal de compra/venda é produzido.

### Cache de séries temporais normalizadas

O script `time-series:precompute` transforma os registros trimestrais da CVM ITR em séries temporais limpas por métrica:

```bash
npm run time-series:precompute
```

Gera um arquivo JSON por ticker em `src/data/forecast-cache/time-series/`, contendo:

- Séries para 15 métricas: receita, EBIT, lucro líquido, CFO, capex, FCL, caixa, dívida total, dívida líquida, margens e crescimentos YoY.
- Pontos ordenados cronologicamente com anotação de fonte (`cvm_itr`, `cvm_dfp_derived_q4`, `derived`).
- Valores ausentes preservados como `null` (zero significa zero reportado).
- Metadados de qualidade por série: observações, ausências, outliers, períodos de início/fim.

A rota `/api/forecasting/time-series/[ticker]` serve o cache normalizado (somente leitura, 404 quando indisponível).

### Cache de previsões baseline

O script `forecast:precompute:baseline` gera projeções por ticker usando modelos simples e auditáveis:

```bash
npm run forecast:precompute:baseline
```

Gera um arquivo JSON por ticker em `src/data/forecast-cache/baseline-forecasts/`, contendo:

- Projeções para até 8 métricas: receita, EBIT, lucro líquido, CFO, FCL, margens EBIT/líquida/FCL.
- 4 modelos baseline implementados: `naive`, `seasonal_naive`, `moving_average_4q`, `linear_trend`.
- Retroteste walk-forward por modelo com MAE, RMSE, MAPE, sMAPE, WAPE.
- Seleção automática do melhor modelo por menor WAPE (fallback: menor sMAPE).
- Bandas de incerteza heurísticas (`yhatLower`, `yhatUpper`) baseadas no erro de retroteste.
- Horizon padrão: 8 trimestres. Configurável via `FORECAST_HORIZON_QUARTERS`.

A rota `/api/forecasting/baseline/[ticker]` serve o cache de previsões (somente leitura, 404 quando indisponível). Esta rota **não está conectada ao dashboard atual** — é infraestrutura para o ForecastPanel futuro.

Para o design técnico completo do Forecast Layer, consulte [`docs/forecast-layer-design.md`](docs/forecast-layer-design.md).

---

## Mapa Macro — camada de dados (v1)

Fase 1 do Mapa Macro: contratos, cache e API. A interface (mapa, ranking, legenda) ainda
não existe; os protótipos em `.claude/reference/macro-designer/` são apenas referência
visual e seus números são fictícios.

| Indicador (`id`) | Rótulo | Unidade | Fonte | Código |
|---|---|---|---|---|
| `inflation` | Inflação | % | IMF WEO | `PCPIPCH` (IPC, média anual, variação %) |
| `policy_rate` | Taxa básica | % a.a. | BIS | `WS_CBPOL`, mensal (fim do mês) |
| `real_gdp_growth` | Crescimento real do PIB | % | IMF WEO | `NGDP_RPCH` |
| `unemployment` | Desemprego | % | IMF WEO | `LUR` |
| `gov_debt_gdp` | Dívida pública / PIB | % do PIB | IMF WEO | `GGXWDG_NGDP` |

- **Fontes oficiais via SDMX, sem autenticação:** IMF Data Portal
  (`api.imf.org/external/sdmx/2.1`, dataflow `IMF.RES:WEO`) e BIS
  (`stats.bis.org/api/v2`, dataflow `BIS:WS_CBPOL(1.0)`).
- **Países:** chave interna ISO 3166-1 alfa-3 (`src/lib/macro/country-metadata.ts`). O BIS usa
  alfa-2, com mapeamento explícito. Os códigos WEO `KOS`→`XKX` e `WBG`→`PSE` também são
  explícitos. Não há busca por nome. Agregados (WEO `G***`, BIS `XM` = área do euro) não
  viram países; `XM` fica guardado em `aggregates` como área de referência.
- **Status (WEO):**
  - `observed` até `LATEST_ACTUAL_ANNUAL_DATA` do FMI (ano fiscal `FY2024/25` conta como 2024).
  - `estimated` em todos os anos seguintes, inclusive o ano da edição e os posteriores. O FAQ do
    WEO define os anos após o último dado efetivo como estimativas da equipe do FMI, e avisa que
    o período sombreado de previsão do relatório não necessariamente coincide com esse metadado.
  - Sem `LATEST_ACTUAL_ANNUAL_DATA` (ausente ou zero), tudo é `estimated`.
  - `projected` existe no tipo, mas não é emitido para o WEO, porque o FMI não marca projeções
    por observação.
  - `no_data` com `value: null` quando não há observação.
  - A regra não usa o ano da edição nem a data atual, e está registrada em `statusMethodology`
    em cada cache.
- **Taxa básica:** para cada ano, vale a última observação mensal disponível naquele ano
  (no ano corrente, o mês mais recente). `referencePeriod` mostra o mês (ex.: `2026-09`) e
  `sourceArea` indica a área BIS usada.
- **Área do euro:** `src/lib/macro/euro-area.ts` lista os 21 membros com a data de adoção
  (fonte: BCE, lista de países "Euro since"; todas as adoções em 1º de janeiro, ex.: Decisão
  do Conselho (UE) 2025/1407 para a Bulgária em 2026).
  - Antes da adoção, o membro usa a própria série nacional do BIS, quando existe.
  - A partir do mês de adoção, usa a taxa do BCE (BIS `XM`) com `sourceArea: "XM"` e
    `sourceAreaName: "Área do euro (BCE)"`, mantendo o ISO-3 do país como geografia.
  - `XM` nunca é aplicado antes da adoção nem a países fora do euro (ex.: POL, GBR, DNK,
    SWE); a validação do cache rejeita esses casos.
- **Cache:** `src/data/macro-cache/<indicador>.json`, normalizado e determinístico. O WEO
  começa em 2000; a taxa básica começa em 1990, para preservar as séries nacionais
  anteriores ao euro. Inclui fonte, edição (`vintage`), `generatedAt`, anos disponíveis e
  último período.
- **Geração:** `npm run macro:precompute`.
  - Os dados baixados ficam só em memória.
  - Cada cache é validado e comparado com o anterior antes de qualquer gravação: queda de
    cobertura, encurtamento de anos, valores todos nulos, edição retrocedendo, ISO inválido
    ou duplicatas abortam sem gravar nada (exit 1).
  - A escrita é atômica (arquivo temporário + rename).
  - A atualização automática ainda não faz parte do workflow semanal.
- **API:** `GET /api/macro/[indicator]?year=YYYY` lê apenas o cache estático.
  - Indicador desconhecido retorna 404, ano inválido 400 e cache ausente 503.
  - Sem `year`, usa o ano da edição da fonte.
  - Para o painel de país, use `getMacroCountrySnapshot(iso3, ano)` em `src/lib/macro/macro-cache.ts`.
- **Atribuição:** "IMF — World Economic Outlook, Oct/2026" e "BIS — Central bank policy
  rates", disponíveis em `source.attribution`. Os dados seguem os termos de uso do FMI
  (imf.org/external/terms.htm) e do BIS (bis.org/terms_conditions.htm), que pedem
  citação da fonte.

---

## Scripts disponíveis

### Validação

```bash
npm run validate   # executa todas as verificações antes de commit (ver abaixo)
```

`npm run validate` encadeia:
1. `typecheck` — verificação TypeScript (`tsc --noEmit`)
2. `test` — suite de testes Vitest
3. `coverage:audit:models` — auditoria de roteamento de modelos (offline)
4. `report:audit` — auditoria de rotas de relatório por ticker (offline)
5. `build` — build de produção Next.js

O mesmo comando é executado automaticamente em CI (push e pull request para `main`).

### Desenvolvimento

```bash
npm run dev                       # servidor de desenvolvimento
npm run build                     # build de produção
npm test                          # testes com Vitest
npm run typecheck                 # verificação TypeScript sem emitir
```

### Auditorias

```bash
npm run coverage:audit:models     # auditoria de roteamento de modelos do dashboard (offline)
npm run report:audit              # auditoria de rotas de relatório por ticker (offline)
npm run coverage:audit:quote-only # classifica ativos quote-only, sem modelo e indisponíveis (offline)
npm run coverage:audit            # audita cobertura B3 por tipo de ativo e nível (offline)
npm run cvm:audit                 # audita disponibilidade de dados CVM via API local
npm run cvm:audit:quarterly       # audita valores trimestrais por ticker e métrica
npm run cache:audit:freshness     # idade dos caches por família (offline, informativo)
```

### Cache e pré-computação

```bash
npm run cvm:precompute            # regenera cache CVM anual (DFP) para todos os tickers
npm run cvm:precompute:quarterly  # regenera cache CVM trimestral (ITR) para todos os tickers
npm run time-series:precompute         # gera cache de séries temporais normalizadas a partir do ITR
npm run forecast:precompute:baseline   # gera cache de previsões baseline (local, sem rede)
npm run bank:precompute                # gera cache bancário anual via CVM DFP
npm run fii:precompute                 # gera cache de FII via CVM informe mensal
npm run insurance:precompute           # gera cache de seguradora anual via CVM DFP
npm run macro:precompute               # gera caches do Mapa Macro (IMF WEO + BIS), com guarda de regressão
```

### Atualização automática de caches

O workflow `.github/workflows/cache-refresh.yml` atualiza os caches JSON versionados
em `src/data/` toda semana e só faz commit quando o conteúdo gerado mudou de fato.

- **Agenda:** domingos às 06:15 UTC (`15 6 * * 0`). O GitHub não garante o início
  no minuto exato; execuções agendadas podem atrasar em horários de carga.
- **Manual:** `workflow_dispatch` com `scope` = `all` (padrão), `industrial`,
  `sector-models` ou `forecasts`. Execuções agendadas usam sempre `all`.
  Só roda a partir de `main`.
- **Ordem de atualização:**
  1. CVM anual — DFP e documentos (`cvm:precompute`, `CVM_CONCURRENCY=1`, `CVM_DFP_INNER_CONCURRENCY=1`, memória registrada por ticker com `CVM_MEMORY_LOG=1`) — rede.
     Exercícios fechados de 2020 até o ano anterior (ex.: 2020–2025 durante 2026),
     ajustáveis com `CVM_DFP_START_YEAR`/`CVM_DFP_END_YEAR`; o mesmo vale para bancos
  2. CVM trimestral — ITR (`cvm:precompute:quarterly`, heap de 4 GB) — rede; o Q4
     é derivado do cache anual, por isso roda depois dele
  3. Bancos, FIIs e seguradoras (`bank:`, `fii:`, `insurance:precompute`, concorrência 1) — rede.
     Bancos e seguradoras usam identidades CVM verificadas (`src/lib/cvm/sector-model-identities.ts`,
     conferidas contra o cadastro CVM a cada execução); busca por nome só manualmente
     com `SECTOR_ALLOW_FUZZY_CVM_MATCH=1`
  4. Séries temporais (`time-series:precompute`) — local, lê o cache trimestral
  5. Previsões baseline (`forecast:precompute:baseline`) — local, lê as séries
- **Fonte:** apenas dados abertos da CVM (`dados.cvm.gov.br`). Nenhum mapeamento CVM
  novo é descoberto ou adicionado automaticamente.
- **Barreira de validação:** `coverage:audit:quote-only`, `coverage:audit:models`,
  `report:audit`, `npm run validate`, `git diff --check` e verificação de arquivos
  ZIP/CSV brutos em `src/data`. Qualquer falha encerra o job sem commit nem push.
- **Guarda de arquivos alterados** (`scripts/cache-refresh-guard.ts`, regras em
  `src/lib/cache-refresh/refresh-guard.ts`):
  - descarta arquivos cuja única mudança é `generatedAt`/`updatedAt` (e a data do
    relatório quote-only), evitando commits semanais sem dados novos — o timestamp
    passa a indicar a última mudança real de conteúdo;
  - só aceita JSON em `src/data/{cvm,forecast,bank,fii,insurance}-cache/` e
    `docs/coverage-audit-quote-only.md`; qualquer outro caminho (código, scripts,
    `package*.json`, workflows, ZIP/CSV, temporários), remoção ou renomeação falha o job
    e lista os caminhos rejeitados;
  - rejeita regressões de dados (histórico menor, cache que vira `available: false`,
    documentos zerados), pois os clientes CVM tratam falhas de rede como dados vazios.
- **Commit:** apenas os caminhos aprovados são adicionados (nunca `git add .`), como
  `github-actions[bot]`, com a mensagem `chore(data): refresh financial caches`.
  Sem mudanças, imprime `No cache changes detected` e termina com sucesso.
- **CI após o push:** pushes feitos com `GITHUB_TOKEN` não disparam outros workflows,
  então o job dispara `ci.yml` explicitamente (`workflow_dispatch`) para validar o
  novo commit de forma independente.
- Arquivos ZIP/CSV brutos da CVM nunca são gravados nem commitados.

`npm run cache:audit:freshness` lista, por família de cache, a quantidade de arquivos,
os timestamps mais antigo e mais recente e os arquivos acima do limite de idade.
É offline, somente leitura e informativo (não falha por idade).

---

## Tecnologias

- Next.js 15 (App Router)
- React 19
- TypeScript
- Vitest
- fflate (unzip de ZIPs CVM em memória)
- CSS global e estilos inline
- SVG puro para gráficos
- CVM Dados Abertos (dados.cvm.gov.br)
- brapi para cotações de mercado

---

## Estrutura do projeto

```txt
src/
├── app/
│   ├── api/
│   │   ├── coverage/[ticker]/  ← perfil de cobertura B3 (somente leitura, offline)
│   │   ├── cvm/
│   │   │   ├── company/[ticker]/
│   │   │   ├── documents/[ticker]/
│   │   │   └── financials/[ticker]/
│   │   ├── macro/[indicator]/  ← Mapa Macro: um indicador × ano (cache estático)
│   │   └── market-data/[ticker]/
│   ├── cobertura/
│   ├── dashboard/
│   ├── metodologia/
│   ├── relatorio/[ticker]/
│   ├── sobre/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx          ← landing page
│
├── components/
│   ├── coverage/
│   ├── dashboard/
│   └── report/
│
├── data/
│   ├── companies/        ← dados mock para tickers full_analysis
│   ├── cvm-cache/        ← cache pré-computado (financials + documents)
│   ├── macro-cache/      ← caches normalizados do Mapa Macro (IMF WEO + BIS)
│   ├── b3-universe.ts
│   └── coverage-types.ts
│
├── lib/
│   ├── coverage/         ← classificador de ativos e resolutor de cobertura B3
│   ├── cvm/              ← pipeline CVM, cache, parser, normalizer
│   ├── forecasting/      ← modelos baseline, backtesting, séries temporais
│   ├── fundamentals/     ← cálculo de indicadores
│   ├── macro/            ← Mapa Macro: contratos, clientes IMF/BIS, normalização, cache
│   ├── market-data/      ← cliente brapi
│   └── formatters.ts
│
└── scripts/
    ├── check-cvm-financials.ts   ← auditoria via API local
    └── precompute-cvm-cache.ts   ← geração do cache pré-computado
```
