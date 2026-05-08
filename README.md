<h1 align="center">Fundamental Copilot BR</h1>

<p align="center">
  <img src="public/logo/logo-icon.svg" width="80"/>
</p>

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

- demonstrações financeiras anuais;
- indicadores fundamentalistas;
- evolução histórica dos resultados;
- métricas de mercado;
- diagnóstico financeiro automatizado;
- cobertura por ativo;
- documentos e eventos oficiais quando disponíveis.

O projeto utiliza dados públicos da **CVM Dados Abertos** e cotações via **brapi**, quando uma chave de API está configurada.

> Projeto em desenvolvimento. As informações exibidas têm finalidade educacional e não constituem recomendação de investimento.

---

## Posicionamento do produto

O projeto foi reposicionado para priorizar **análise fundamentalista objetiva** em vez de estimativas automáticas de preço.

A plataforma não busca produzir preço-alvo, recomendação de compra/venda ou conclusões definitivas sobre ativos. O foco é apresentar dados financeiros, indicadores e sinais de atenção de forma transparente, padronizada e auditável.

---

## Funcionalidades atuais

- Busca por empresas brasileiras por ticker ou nome.
- Dashboard de análise fundamentalista.
- Integração com dados financeiros anuais da CVM.
- Integração opcional com cotações via brapi.
- Indicadores financeiros organizados por categoria.
- Diagnóstico fundamentalista baseado em regras.
- Tabela histórica de demonstrações financeiras.
- Comparáveis por setor.
- Página de cobertura da B3.
- Página de metodologia.
- Página institucional “Sobre”.
- Relatório imprimível de análise fundamentalista.
- Testes automatizados com Vitest.
- Build e validação TypeScript.

---

## Principais módulos

### 1. Dados CVM

A plataforma utiliza a camada `src/lib/cvm/` para buscar, processar e normalizar dados públicos da CVM.

Atualmente, o sistema trabalha com demonstrações financeiras anuais consolidadas, extraídas dos arquivos DFP da CVM.

Campos normalizados incluem:

- Receita;
- EBIT;
- Lucro líquido;
- Fluxo de caixa operacional;
- Capex;
- Fluxo de caixa livre;
- Caixa;
- Dívida total;
- Dívida líquida.

### 2. Indicadores fundamentalistas

Os indicadores são calculados a partir dos dados financeiros normalizados e, quando disponível, de dados de mercado.

Categorias atuais:

- Crescimento;
- Margens;
- Geração de caixa;
- Endividamento;
- Métricas de mercado.

Exemplos de indicadores:

- Crescimento da receita;
- CAGR da receita;
- Margem EBIT;
- Margem líquida;
- Margem de fluxo de caixa livre;
- Conversão de lucro em caixa;
- Capex / Receita;
- Dívida líquida / EBIT;
- Caixa / Dívida total;
- Market Cap;
- Enterprise Value;
- P/L;
- EV/EBIT;
- EV/Receita;
- FCF Yield.

Quando uma métrica não pode ser calculada com segurança, a interface exibe `N/D`.

### 3. Diagnóstico fundamentalista

O diagnóstico é gerado por regras transparentes, sem recomendação de investimento.

Exemplos de observações:

- Receita cresceu ou caiu no último ano;
- Margem EBIT expandiu ou comprimiu;
- Fluxo de caixa livre foi positivo ou negativo;
- Lucro líquido foi ou não convertido em caixa operacional;
- Dívida líquida está acima ou abaixo do EBIT anual;
- Histórico financeiro é suficiente ou insuficiente para análise.

Os sinais são classificados como:

- Sinal positivo;
- Ponto de atenção;
- Neutro;
- Limitação dos dados.

### 4. Cobertura da B3

Cada ativo possui um status de cobertura, usado na busca e na página `/cobertura`.

Status atuais:

| Status interno | Rótulo | Descrição |
|---|---|---|
| `full_analysis` | Análise completa | Dashboard completo com dados financeiros, indicadores, diagnóstico e métricas de mercado. |
| `cvm_analysis` | Análise CVM | Análise fundamentalista gerada automaticamente com dados CVM suficientes. |
| `cvm_financials` | Dados CVM | Dados CVM disponíveis, mas ainda sem histórico ou normalização suficiente para análise completa. |
| `quote_only` | Cotação | Cotação disponível; dados financeiros ainda pendentes. |
| `sector_specific_model_required` | Modelo específico | Ativo exige metodologia própria, como bancos, seguradoras, FIIs, ETFs ou BDRs. |
| `unavailable` | Em breve | Ainda sem cobertura confiável. |

### 5. Documentos e eventos

A seção **Documentos e Eventos** tem como objetivo exibir documentos públicos e eventos relevantes associados às empresas analisadas.

A integração deve priorizar fontes oficiais e públicas. Conteúdos ilustrativos, quando existirem durante o desenvolvimento, devem ser claramente identificados como exemplos de interface e não como eventos reais.

---

## Tecnologias

- Next.js
- React
- TypeScript
- Vitest
- CSS global e estilos inline
- SVG puro para gráficos
- CVM Dados Abertos
- brapi para dados de mercado

---

## Estrutura geral do projeto

```txt
src/
├── app/
│   ├── api/
│   │   ├── cvm/
│   │   └── market-data/
│   ├── cobertura/
│   ├── metodologia/
│   ├── relatorio/
│   ├── sobre/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
│
├── components/
│   ├── coverage/
│   ├── dashboard/
│   └── report/
│
├── data/
│   ├── companies/
│   ├── b3-universe.ts
│   └── coverage-types.ts
│
├── lib/
│   ├── cvm/
│   ├── fundamentals/
│   ├── market-data/
│   └── formatters.ts
│
├── public/
│   └── logo/
│
└── scripts/
    └── check-cvm-financials.ts
