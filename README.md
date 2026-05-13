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
- Testes automatizados com Vitest.
- Build e validação TypeScript.

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

---

## Planejado: Forecast Layer

Uma versão futura da plataforma poderá incluir uma camada de **projeções quantitativas de fundamentos empresariais**. O objetivo é estimar receita, EBIT, EBITDA, fluxo de caixa e margens com base em dados históricos da CVM, usando modelos de séries temporais avaliados por backtesting rigoroso.

Características planejadas:
- projeções de fundamentos, **não** de preço de ação ou valor justo;
- modelos baseline (naive, seasonal naive, CAGR) comparados contra modelos estatísticos e de fundação;
- precomputação offline — nenhum modelo roda durante o carregamento do dashboard;
- bandas de incerteza visíveis e metadados de qualidade do modelo em cada projeção;
- aviso explícito: as projeções são estimativas quantitativas e não constituem recomendação de investimento.

Para o design técnico detalhado, consulte [`docs/forecast-layer-design.md`](docs/forecast-layer-design.md).

> Esta funcionalidade não está implementada. Nenhum modelo de ML, pacote Python de forecasting ou rota de API foi adicionado.

---

## Scripts disponíveis

```bash
npm run dev             # servidor de desenvolvimento
npm run build           # build de produção
npm run test            # testes com Vitest
npm run cvm:precompute  # regenera cache CVM para todos os tickers cobertos
npm run cvm:audit       # audita disponibilidade de dados CVM via API local
```

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
│   │   ├── cvm/
│   │   │   ├── company/[ticker]/
│   │   │   ├── documents/[ticker]/
│   │   │   └── financials/[ticker]/
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
│   ├── b3-universe.ts
│   └── coverage-types.ts
│
├── lib/
│   ├── cvm/              ← pipeline CVM, cache, parser, normalizer
│   ├── fundamentals/     ← cálculo de indicadores
│   ├── market-data/      ← cliente brapi
│   └── formatters.ts
│
└── scripts/
    ├── check-cvm-financials.ts   ← auditoria via API local
    └── precompute-cvm-cache.ts   ← geração do cache pré-computado
```
