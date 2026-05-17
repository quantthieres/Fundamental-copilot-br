# Coverage Layer — Classificação de Ativos B3

## Visão geral

A camada de cobertura em `src/lib/coverage/` centraliza a classificação de ativos B3 por tipo e a determinação do nível de análise disponível. Ela é independente do pipeline CVM e não acessa APIs externas.

## Problema resolvido

Nem todo ativo negociado na B3 é uma empresa operacional que pode ser avaliada pelo modelo industrial padrão (métricas de receita, EBIT, FCL, endividamento). Forçar indicadores industriais em bancos, FIIs, ETFs ou BDRs produziria métricas sem sentido econômico. A camada de cobertura:

1. Classifica o ativo por tipo (`AssetType`).
2. Determina o nível de análise disponível (`AnalysisCoverageLevel`).
3. Retorna mensagens de exibição em português apropriadas para o tipo.
4. Não produz valuation, DCF, preço-alvo, recomendação ou sinal de compra/venda.

## Módulos

### `coverage-types.ts`

Define os tipos centrais:

- **`AssetType`** — tipo granular do ativo (11 valores: `common_stock`, `preferred_stock`, `unit`, `bank`, `insurance`, `financial`, `fii`, `etf`, `bdr`, `fund`, `unknown`).
- **`AnalysisCoverageLevel`** — nível de análise disponível (6 valores, compatíveis com `CoverageStatus` em `src/data/coverage-types.ts`).
- **`CoverageReasonCode`** — código diagnóstico da razão do nível de cobertura (13 valores).
- **`AssetCoverageProfile`** — perfil completo combinando tipo, nível, flags e mensagem de exibição.

### `asset-classifier.ts`

Exporta quatro funções puras:

| Função | Descrição |
|---|---|
| `normalizeTicker(ticker)` | Uppercase + remove caracteres não alfanuméricos |
| `inferAssetTypeFromTicker(ticker)` | Mapa explícito + sufixo numérico |
| `inferAssetTypeFromKnownMappings(ticker, name?, sector?)` | Refina com nome e setor |
| `classifyAsset(ticker, context?)` | Classificação completa com contexto B3 |

#### Regras de sufixo (fallback quando não há mapeamento explícito)

| Sufixo | Tipo inferido |
|---|---|
| `3` | `common_stock` |
| `4`–`8` | `preferred_stock` |
| `11` | `unit` (refinado por contexto) |
| `34` | `bdr` |

#### Mapa explícito de tickers conhecidos

O mapa `EXPLICIT_TICKER_MAP` cobre casos onde o sufixo é insuficiente:

- **Units bancárias**: SANB11, BPAC11 → `bank` (não `unit`)
- **Units de seguradoras**: SULA11 → `insurance`
- **Units operacionais**: KLBN11, ALUP11, TAEE11, SAPR11 → `unit`
- **FIIs**: MXRF11, HGLG11, KNRI11, etc. → `fii`
- **ETFs**: BOVA11, IVVB11, HASH11, etc. → `etf`
- **BDRs explícitos**: AAPL34, MSFT34, TSLA34 → `bdr`

### `coverage-resolver.ts`

Exporta `resolveAssetCoverage(input): AssetCoverageProfile`.

#### Entrada (`CoverageResolverInput`)

```typescript
{
  ticker: string;
  assetType: AssetType;
  hasMarketData: boolean;
  hasCvmCompany: boolean;
  hasAnnualFinancials: boolean;
  hasQuarterlyFinancials: boolean;
  hasTimeSeries: boolean;
  hasBaselineForecast: boolean;
  companyName?: string;
  sector?: string;
}
```

#### Lógica de resolução

**Passo 1 — elegibilidade industrial:**
Apenas `common_stock`, `preferred_stock` e `unit` são elegíveis para o modelo industrial. Os demais são `sector_specific_model_required`.

**Passo 2 — para ativos industriais, hierarquia de nível:**

| Condição | Nível | Código |
|---|---|---|
| annual + quarterly + timeseries + forecast | `full_analysis` | `HAS_FULL_CVM_AND_FORECAST` |
| annual + (quarterly ou timeseries) | `cvm_analysis` | `HAS_CVM_FINANCIALS` |
| annual apenas | `cvm_financials` | `HAS_CVM_BUT_LIMITED_METRICS` |
| CVM mapeado, sem cache | `cvm_financials` | `HAS_CVM_BUT_LIMITED_METRICS` |
| mercado apenas | `quote_only` | `NO_CVM_MAPPING` |
| nenhum dado | `unavailable` | `NO_MARKET_DATA` |

**Passo 3 — para ativos não industriais:**

| Tipo | Nível | Código |
|---|---|---|
| `bank` | `sector_specific_model_required` | `BANK_MODEL_REQUIRED` |
| `insurance` | `sector_specific_model_required` | `INSURANCE_MODEL_REQUIRED` |
| `fii` | `sector_specific_model_required` | `FII_MODEL_REQUIRED` |
| `etf` | `sector_specific_model_required` | `ETF_MODEL_REQUIRED` |
| `bdr` | `sector_specific_model_required` | `BDR_MODEL_REQUIRED` |
| `financial`, `fund`, `unknown` | `sector_specific_model_required` | `UNKNOWN_ASSET_TYPE` |

## API de cobertura

`GET /api/coverage/[ticker]`

- Somente leitura — verifica existência de arquivos de cache local com `existsSync`.
- Não aciona pipelines CVM ao vivo.
- Não computa projeções.
- Retorna `{ coverage: AssetCoverageProfile }` com status 200 sempre (mesmo para `unavailable`).
- `hasMarketData` é inferido da presença no universo B3 (sem chamada à brapi).

## Integração com o dashboard

O `DashboardPageClient` usa a função `getSectorSpecificDetail(b3Entry)` para exibir mensagens específicas por tipo de ativo no estado `EmptyStateView`:

| Tipo de ativo (B3 universe) | Mensagem exibida |
|---|---|
| `fii` | "Este ativo exige modelo específico para fundos imobiliários." |
| `etf` | "Este ativo representa um fundo/índice e não utiliza demonstrações financeiras corporativas tradicionais." |
| `bdr` | "Este ativo representa recibo de ativo estrangeiro e exige tratamento específico." |
| setor "Bancário" / "Holding Financeira" | "Este ativo exige modelo específico para instituições financeiras." |
| setor "Seguros" | "Este ativo exige modelo específico para seguradoras." |

O dashboard existente não foi reescrito — apenas o texto do estado `sector_specific_model_required` foi refinado.

## Modelos setoriais futuros

A camada de cobertura está preparada para receber modelos setoriais específicos no futuro:

- **Bancos**: P/VPA, ROE bancário, índice de Basileia, NIM, inadimplência.
- **Seguradoras**: índice combinado, sinistralidade, prêmios emitidos.
- **FIIs**: DY, NAV, vacância, composição de carteira (papel vs. tijolo).
- **ETFs/BDRs**: composição do índice, tracking error, liquidez.

Quando esses modelos forem implementados, o `resolveAssetCoverage` pode ser extendido para retornar níveis de cobertura específicos por setor sem alterar a interface pública.

## Testes

- `src/lib/coverage/asset-classifier.test.ts` — 35+ casos cobrindo mapa explícito, padrões de sufixo e classificação contextual.
- `src/lib/coverage/coverage-resolver.test.ts` — 20+ casos cobrindo todos os níveis, todos os tipos e garantias de ausência de linguagem de valuation.
