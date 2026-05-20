import React from "react";
import AppHeader from "@/components/layout/AppHeader";

// ─── Shared primitives ────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, letterSpacing: "0.8px",
      textTransform: "uppercase", color: "#94a3b8", marginBottom: 12,
    }}>
      {children}
    </div>
  );
}

function Section({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ marginBottom: 36, ...style }}>{children}</div>;
}

function Card({
  label,
  title,
  accent,
  children,
}: {
  label?: string;
  title: string;
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{
      background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10,
      overflow: "hidden",
    }}>
      <div style={{
        padding: "14px 22px 12px",
        borderBottom: "1px solid #f1f5f9",
        borderLeft: accent ? `3px solid ${accent}` : undefined,
        paddingLeft: accent ? 19 : 22,
      }}>
        {label && (
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: "0.7px",
            textTransform: "uppercase", color: "#94a3b8", marginBottom: 4,
          }}>
            {label}
          </div>
        )}
        <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", letterSpacing: "-0.2px" }}>
          {title}
        </div>
      </div>
      <div style={{ padding: "18px 22px" }}>
        {children}
      </div>
    </div>
  );
}

function Prose({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ margin: "0 0 12px", fontSize: 14, color: "#374151", lineHeight: 1.75 }}>
      {children}
    </p>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
      {items.map((item, i) => (
        <li key={i} style={{
          display: "flex", gap: 10, padding: "6px 0",
          borderBottom: i < items.length - 1 ? "1px solid #f8fafc" : "none",
          fontSize: 14, color: "#374151", lineHeight: 1.6,
        }}>
          <span style={{ color: "#94a3b8", flexShrink: 0, paddingTop: 1 }}>—</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function StepList({ steps }: { steps: string[] }) {
  return (
    <ol style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
      {steps.map((step, i) => (
        <li key={i} style={{
          display: "flex", alignItems: "flex-start", gap: 12,
          padding: "7px 0", borderBottom: i < steps.length - 1 ? "1px solid #f1f5f9" : "none",
        }}>
          <span style={{
            flexShrink: 0, width: 22, height: 22, borderRadius: 6,
            background: "#f1f5f9", display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 11, fontWeight: 700,
            color: "#475569", fontFamily: "'JetBrains Mono', monospace",
          }}>
            {i + 1}
          </span>
          <span style={{ fontSize: 14, color: "#374151", lineHeight: 1.5, paddingTop: 3 }}>
            {step}
          </span>
        </li>
      ))}
    </ol>
  );
}

function InfoBox({ color, children }: { color: "blue" | "yellow" | "green"; children: React.ReactNode }) {
  const palette = {
    blue:   { bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8" },
    yellow: { bg: "#fefce8", border: "#fde68a", text: "#92400e" },
    green:  { bg: "#f0fdf4", border: "#bbf7d0", text: "#166534" },
  }[color];
  return (
    <div style={{
      background: palette.bg, border: `1px solid ${palette.border}`,
      borderRadius: 8, padding: "10px 14px",
      fontSize: 12, color: palette.text, lineHeight: 1.65,
    }}>
      {children}
    </div>
  );
}

// ─── Model mini-cards ────────────────────────────────────────────────────────

interface ModelMiniCard {
  label: string;
  color: string;
  bg: string;
  items: string[];
}

const MODEL_MINI_CARDS: ModelMiniCard[] = [
  {
    label: "Empresas operacionais",
    color: "#2563eb", bg: "#eff6ff",
    items: [
      "DFP anual consolidada (CVM)",
      "Indicadores: margem, crescimento, caixa, dívida",
      "Diagnóstico baseado em regras",
      "Sem preço-alvo ou recomendação",
    ],
  },
  {
    label: "Bancos",
    color: "#15803d", bg: "#f0fdf4",
    items: [
      "Modelo específico para instituições financeiras",
      "Ativos, patrimônio, lucro, ROE, ROA",
      "Sem receita industrial, EBIT ou FCL",
      "Dados CVM — DFP anual",
    ],
  },
  {
    label: "FIIs",
    color: "#6d28d9", bg: "#f5f3ff",
    items: [
      "Informe Mensal CVM",
      "Patrimônio, P/VP, DY 12m quando confiável",
      "Distribuições ausentes não tratadas como zero",
      "Sem classificação barato/caro",
    ],
  },
  {
    label: "Seguradoras",
    color: "#c2410c", bg: "#fff7ed",
    items: [
      "Modelo específico para seguradoras",
      "Ativos, patrimônio, lucro, ROE, ROA",
      "Campos específicos de seguro quando disponíveis",
      "Sem comparação com empresas industriais",
    ],
  },
  {
    label: "ETFs e BDRs",
    color: "#0369a1", bg: "#f0f9ff",
    items: [
      "Camada informativa — sem análise fundamentalista",
      "Contexto de mercado e instrumento",
      "Sem modelo de projeção ou valuation",
      "Cotação via brapi quando disponível",
    ],
  },
  {
    label: "Projeções",
    color: "#b45309", bg: "#fffbeb",
    items: [
      "Modelos quantitativos simples (baseline)",
      "Projeção de fundamentos, não de preço",
      "Diagnóstico de qualidade: Alta/Média/Baixa/Insuficiente",
      "Não é recomendação de investimento",
    ],
  },
];

function ModelMiniCards() {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
      gap: 12,
    }}>
      {MODEL_MINI_CARDS.map(card => (
        <div key={card.label} style={{
          background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10,
          overflow: "hidden",
        }}>
          <div style={{
            background: card.bg, padding: "10px 16px",
            borderBottom: "1px solid #e2e8f0",
          }}>
            <span style={{
              fontSize: 11, fontWeight: 700, color: card.color,
              letterSpacing: "0.2px",
            }}>
              {card.label}
            </span>
          </div>
          <ul style={{ margin: 0, padding: "12px 16px", listStyle: "none" }}>
            {card.items.map((item, i) => (
              <li key={i} style={{
                display: "flex", gap: 8, fontSize: 12, color: "#475569",
                lineHeight: 1.5, padding: "3px 0",
              }}>
                <span style={{ color: "#cbd5e1", flexShrink: 0 }}>·</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// ─── Routing table ────────────────────────────────────────────────────────────

interface RoutingRow {
  tipo: string;
  camada: string;
  dados: string;
  naoAplicado: string;
}

const ROUTING_ROWS: RoutingRow[] = [
  {
    tipo:        "Empresa operacional",
    camada:      "Análise fundamentalista CVM",
    dados:       "DFP anual — receita, EBIT, lucro, CFO, capex, dívida",
    naoAplicado: "Métricas bancárias, NAV, indicadores de seguro",
  },
  {
    tipo:        "Banco",
    camada:      "Modelo bancário",
    dados:       "Ativos, patrimônio, lucro, ROE, ROA, relação equity/ativos",
    naoAplicado: "Receita industrial, EBIT, FCL, múltiplos setoriais",
  },
  {
    tipo:        "FII",
    camada:      "Modelo de fundos imobiliários",
    dados:       "Patrimônio, NAV por cota, P/VP, DY 12m (quando confiável)",
    naoAplicado: "Receita industrial, indicadores bancários",
  },
  {
    tipo:        "Seguradora",
    camada:      "Modelo de seguradoras",
    dados:       "Ativos, patrimônio, lucro, ROE, ROA e campos específicos",
    naoAplicado: "Receita industrial, FCL, múltiplos de EBITDA",
  },
  {
    tipo:        "ETF / BDR",
    camada:      "Camada informativa",
    dados:       "Cotação de mercado, tipo do instrumento, descrição",
    naoAplicado: "Qualquer análise fundamentalista corporativa, projeção",
  },
  {
    tipo:        "Ativo descontinuado",
    camada:      "Estado indisponível",
    dados:       "Nenhum",
    naoAplicado: "Qualquer análise ou cotação",
  },
];

function RoutingTable() {
  return (
    <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid #e2e8f0" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
            {["Tipo de ativo", "Camada aplicada", "Principais dados", "O que não é aplicado"].map(h => (
              <th key={h} style={{
                padding: "9px 14px", textAlign: "left",
                fontSize: 11, fontWeight: 700, color: "#64748b",
                letterSpacing: "0.4px", textTransform: "uppercase", whiteSpace: "nowrap",
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROUTING_ROWS.map((row, i) => (
            <tr key={row.tipo} style={{ borderBottom: i < ROUTING_ROWS.length - 1 ? "1px solid #f1f5f9" : "none" }}>
              <td style={{ padding: "10px 14px", fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap" }}>
                {row.tipo}
              </td>
              <td style={{ padding: "10px 14px", color: "#374151" }}>
                {row.camada}
              </td>
              <td style={{ padding: "10px 14px", color: "#64748b", maxWidth: 280, lineHeight: 1.45 }}>
                {row.dados}
              </td>
              <td style={{ padding: "10px 14px", color: "#94a3b8", maxWidth: 260, lineHeight: 1.45 }}>
                {row.naoAplicado}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Indicator row (for CVM section) ─────────────────────────────────────────

function FormulaBlock({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6,
      padding: "8px 12px", fontFamily: "'JetBrains Mono', monospace",
      fontSize: 12, color: "#0f172a", margin: "6px 0 8px",
      lineHeight: 1.9, overflowX: "auto",
    }}>
      {children}
    </div>
  );
}

function IndicatorRow({ name, formula, description }: { name: string; formula: string; description: string }) {
  return (
    <div style={{ padding: "11px 0", borderBottom: "1px solid #f1f5f9" }}>
      <div style={{
        fontSize: 13, fontWeight: 700, color: "#0f172a",
        fontFamily: "'JetBrains Mono', monospace", marginBottom: 4,
      }}>
        {name}
      </div>
      <FormulaBlock>{formula}</FormulaBlock>
      <p style={{ margin: 0, fontSize: 13, color: "#374151", lineHeight: 1.6 }}>{description}</p>
    </div>
  );
}

// ─── Disclaimer block ─────────────────────────────────────────────────────────

function Disclaimers() {
  const items = [
    "A plataforma não fornece recomendação de investimento.",
    "As projeções são estimativas quantitativas de fundamentos, não previsões de preço de ação.",
    "A cobertura depende da disponibilidade e padronização dos dados.",
    "Nenhum preço-alvo, valor justo, upside, downside ou linguagem de compra/venda/manutenção é calculado ou exibido.",
    "Os dados têm finalidade educacional e demonstrativa — consulte um profissional certificado antes de tomar decisões de investimento.",
  ];
  return (
    <div style={{
      background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10,
      overflow: "hidden",
    }}>
      <div style={{
        padding: "10px 22px", background: "#f8fafc",
        borderBottom: "1px solid #e2e8f0",
        fontSize: 10, fontWeight: 700, letterSpacing: "0.7px",
        textTransform: "uppercase" as const, color: "#94a3b8",
      }}>
        Aviso legal e limitações
      </div>
      <div style={{ padding: "16px 22px" }}>
        <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
          {items.map((item, i) => (
            <li key={i} style={{
              display: "flex", gap: 10, padding: "6px 0",
              borderBottom: i < items.length - 1 ? "1px solid #f8fafc" : "none",
              fontSize: 13, color: "#374151", lineHeight: 1.65,
            }}>
              <span style={{ color: "#f59e0b", flexShrink: 0, fontWeight: 700 }}>⚠</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function MetodologiaPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "inherit" }}>
      <AppHeader />

      <main style={{ maxWidth: 900, margin: "0 auto", padding: "36px 24px 72px" }}>

        {/* ── Hero ── */}
        <Section>
          <div style={{ marginBottom: 6 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: "0.8px",
              textTransform: "uppercase", color: "#6366f1",
            }}>
              Documentação
            </span>
          </div>
          <h1 style={{
            margin: "0 0 12px", fontSize: 26, fontWeight: 800, color: "#0f172a",
            letterSpacing: "-0.5px", lineHeight: 1.2,
          }}>
            Metodologia
          </h1>
          <p style={{ margin: 0, fontSize: 15, color: "#475569", lineHeight: 1.7, maxWidth: 680 }}>
            Como o Fundamental Copilot BR organiza, trata e apresenta dados fundamentalistas
            e informativos para diferentes tipos de ativos.
          </p>
        </Section>

        {/* ── A. Visão geral ── */}
        <Section>
          <Label>A · Visão geral</Label>
          <Card title="Como a plataforma funciona">
            <Prose>
              O Fundamental Copilot BR não aplica o mesmo modelo a todos os ativos. O primeiro
              passo é sempre classificar o tipo do ativo — empresa operacional, banco, FII,
              seguradora, ETF, BDR ou ativo descontinuado. Depois, o ticker é roteado para a
              camada de análise adequada ao seu tipo.
            </Prose>
            <Prose>
              Esse roteamento evita forçar métricas industriais sobre ativos que não publicam
              demonstrações financeiras corporativas comparáveis — como bancos, FIIs, ETFs e
              BDRs. Cada camada usa os dados disponíveis para aquele tipo específico.
            </Prose>
            <InfoBox color="yellow">
              A plataforma não fornece recomendação de investimento, preço-alvo, valor justo
              ou linguagem de compra/venda/manutenção para nenhum tipo de ativo.
            </InfoBox>
          </Card>
        </Section>

        {/* ── B. Classificação ── */}
        <Section>
          <Label>B · Classificação do ativo</Label>
          <Card title="Roteamento por tipo de ativo">
            <Prose>
              Cada ativo do universo B3 é classificado por tipo antes de ser exibido no
              dashboard. O roteamento determina qual camada de análise é aplicada:
            </Prose>
            <StepList steps={[
              "Empresas operacionais (ações ON/PN/units de companhias industriais, de energia, etc.) → análise fundamentalista CVM com DFP anual.",
              "Bancos → modelo bancário específico com ativos, patrimônio, ROE e ROA extraídos da DFP CVM.",
              "FIIs → modelo de fundos imobiliários com Informe Mensal CVM — patrimônio, P/VP e DY 12m.",
              "Seguradoras → modelo específico com ativos, patrimônio, lucro e campos de seguro da DFP CVM.",
              "ETFs e BDRs → camada informativa — sem análise fundamentalista corporativa.",
              "Ativos descontinuados ou sem cobertura → estado indisponível, sem dados exibidos.",
            ]} />
          </Card>
        </Section>

        {/* ── Resumo de modelos (mini-cards) ── */}
        <Section>
          <Label>Resumo dos modelos</Label>
          <ModelMiniCards />
        </Section>

        {/* ── Tabela de roteamento ── */}
        <Section>
          <Label>Tabela · Roteamento por tipo</Label>
          <RoutingTable />
        </Section>

        {/* ── C. Empresas operacionais ── */}
        <Section>
          <Label>C · Empresas operacionais</Label>
          <Card title="Análise fundamentalista CVM" accent="#2563eb">
            <Prose>
              Para empresas operacionais com mapeamento CVM, a plataforma usa dados da
              Demonstração Financeira Padronizada (DFP) anual consolidada, obtida de
              dados.cvm.gov.br. Os dados são pré-processados e armazenados em cache local —
              o dashboard não executa pipelines pesados em tempo real.
            </Prose>

            <div style={{ marginBottom: 16 }}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: "#64748b",
                textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10,
              }}>
                Pipeline de dados
              </div>
              <StepList steps={[
                "Download do arquivo ZIP da DFP por ano fiscal (dados.cvm.gov.br).",
                "Parsing e filtragem pelo código CVM da empresa-alvo.",
                "Extração das contas-chave: Receita (3.01), EBIT (3.05), Lucro (3.11), CFO (6.01), Capex (6.02), Caixa (1.01.01), Dívida CP (2.01.04), Dívida LP (2.02.01).",
                "Normalização em BRL bilhões e montagem do histórico de até 5 anos.",
                "Armazenamento em cache pré-computado — servido diretamente nas requisições do dashboard.",
              ]} />
            </div>

            <div style={{
              fontSize: 11, fontWeight: 700, color: "#64748b",
              textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10,
            }}>
              Indicadores calculados
            </div>

            <IndicatorRow
              name="CAGR Receita (3a)"
              formula={"(Receita_ano3 / Receita_ano1) ^ (1/2) − 1"}
              description="Crescimento anual composto da receita nos últimos 3 anos disponíveis. Requer ao menos 3 anos com receita positiva."
            />
            <IndicatorRow
              name="Margem EBIT"
              formula={"EBIT / Receita Líquida"}
              description="Percentual da receita convertido em resultado operacional antes de juros e impostos."
            />
            <IndicatorRow
              name="Margem Líquida"
              formula={"Lucro Líquido / Receita Líquida"}
              description="Percentual da receita convertido em lucro após todos os custos, impostos e despesas financeiras."
            />
            <IndicatorRow
              name="Margem FCL"
              formula={"FCL / Receita Líquida   •   FCL = CFO − Capex"}
              description="Percentual da receita convertido em fluxo de caixa livre. FCL negativo indica que o investimento supera o caixa gerado."
            />
            <IndicatorRow
              name="Dívida Líquida / EBIT"
              formula={"(Dívida Total − Caixa) / EBIT"}
              description="Anos de resultado operacional necessários para quitar a dívida líquida. Indicador de alavancagem financeira."
            />

            <div style={{ marginTop: 16 }}>
              <InfoBox color="blue">
                <strong>Diagnóstico baseado em regras:</strong> a plataforma aplica regras
                determinísticas ao histórico normalizado para emitir observações objetivas sobre
                crescimento, margens, qualidade do lucro e endividamento. Não há modelo de
                linguagem ou aprendizado de máquina. Nenhuma observação constitui recomendação.
              </InfoBox>
            </div>
          </Card>
        </Section>

        {/* ── D. Bancos ── */}
        <Section>
          <Label>D · Bancos</Label>
          <Card title="Modelo bancário" accent="#15803d">
            <Prose>
              Bancos possuem estrutura contábil distinta de empresas industriais. A plataforma
              aplica um modelo específico que usa as demonstrações anuais CVM (DFP) e extrai
              métricas adequadas ao segmento financeiro.
            </Prose>
            <BulletList items={[
              "Ativos totais e patrimônio líquido como base da análise.",
              "Lucro líquido, ROE (Retorno sobre Patrimônio) e ROA (Retorno sobre Ativos).",
              "Relação patrimônio/ativos como indicador de solidez de capital.",
              "Dados anuais — versão atual conservadora, com histórico de até 5 anos.",
            ]} />
            <div style={{ marginTop: 14 }}>
              <InfoBox color="green">
                Receita industrial, EBIT, FCL e múltiplos de EBITDA não são calculados nem
                exibidos para bancos. O modelo industrial padrão não se aplica a instituições
                financeiras.
              </InfoBox>
            </div>
          </Card>
        </Section>

        {/* ── E. FIIs ── */}
        <Section>
          <Label>E · Fundos de Investimento Imobiliário (FIIs)</Label>
          <Card title="Modelo de FII" accent="#6d28d9">
            <Prose>
              FIIs utilizam o Informe Mensal CVM como fonte primária, quando disponível. O
              modelo extrai indicadores específicos do segmento imobiliário.
            </Prose>
            <BulletList items={[
              "Patrimônio Líquido (NAV) e NAV por cota.",
              "P/VP (Preço sobre Valor Patrimonial) como referência relativa — sem classificação barato/caro.",
              "DY 12m (Dividend Yield dos últimos 12 meses) calculado apenas quando há distribuições suficientes para cobertura confiável.",
              "Distribuições ausentes não são tratadas como zero — o sistema distingue dado ausente de distribuição zero.",
              "Indicadores industriais (receita, EBIT, FCL, dívida corporativa) não são aplicados.",
            ]} />
          </Card>
        </Section>

        {/* ── F. Seguradoras ── */}
        <Section>
          <Label>F · Seguradoras</Label>
          <Card title="Modelo de seguradora" accent="#c2410c">
            <Prose>
              Seguradoras têm estrutura de receita e contabilidade própria. A plataforma
              aplica um modelo específico extraído da DFP anual CVM.
            </Prose>
            <BulletList items={[
              "Ativos totais, patrimônio líquido e lucro líquido como base.",
              "ROE e ROA calculados a partir dos dados CVM.",
              "Campos específicos de seguro extraídos quando disponíveis nas demonstrações.",
              "Sem comparação direta com empresas industriais ou bancos.",
              "Sem múltiplos de EBITDA ou FCL — métricas industriais não se aplicam.",
            ]} />
          </Card>
        </Section>

        {/* ── G. ETFs e BDRs ── */}
        <Section>
          <Label>G · ETFs e BDRs</Label>
          <Card title="Camada informativa" accent="#0369a1">
            <Prose>
              ETFs (fundos de índice listados em bolsa) e BDRs (recibos de ativos estrangeiros)
              não publicam demonstrações financeiras corporativas comparáveis às de empresas
              operacionais brasileiras. Por isso, recebem uma camada informativa — e não um
              modelo de análise fundamentalista.
            </Prose>
            <BulletList items={[
              "ETFs: a tela exibe o tipo do fundo, o índice ou estratégia replicada, e a cotação de mercado quando disponível.",
              "BDRs: a tela exibe o ativo subjacente estrangeiro, a bolsa de origem e a cotação quando disponível.",
              "Nenhum indicador fundamentalista (receita, EBIT, FCL, ROE, margens) é calculado.",
              "Nenhum modelo de projeção ou forecast é aplicado.",
              "A empresa subjacente do BDR não reporta pela estrutura CVM de companhia brasileira.",
            ]} />
            <div style={{ marginTop: 14 }}>
              <InfoBox color="blue">
                A tela de ETF/BDR é informativa e não constitui recomendação de investimento.
                A plataforma não calcula preço-alvo, valor justo, upside ou downside para
                nenhum desses instrumentos.
              </InfoBox>
            </div>
          </Card>
        </Section>

        {/* ── H. Projeções ── */}
        <Section>
          <Label>H · Projeções de fundamentos</Label>
          <Card title="Baseline quantitativo de fundamentos" accent="#b45309">
            <Prose>
              A plataforma inclui um painel de projeções de fundamentos para empresas
              operacionais com histórico CVM suficiente. As projeções são estimativas
              quantitativas de métricas contábeis — não previsões de preço de ação.
            </Prose>
            <BulletList items={[
              "Modelos de baseline simples: ingênuo (naive), média móvel, tendência linear e sazonalidade quando aplicável.",
              "As projeções são pré-computadas a partir do histórico de demonstrações normalizadas e armazenadas em cache.",
              "O painel exibe o histórico observado, a projeção e uma banda de incerteza heurística.",
              "Diagnóstico de qualidade classifica a confiabilidade como Alta, Média, Baixa ou Insuficiente com score 0–100.",
              "O diagnóstico considera cobertura histórica, consistência dos dados e desempenho no retroteste walk-forward.",
              "ETFs, BDRs, bancos, FIIs e seguradoras não recebem painel de projeções.",
            ]} />
            <div style={{ marginTop: 14 }}>
              <InfoBox color="yellow">
                As projeções são estimativas quantitativas de fundamentos. Não são recomendações,
                previsões de preço, nem indicativos de resultado futuro garantido.
              </InfoBox>
            </div>
          </Card>
        </Section>

        {/* ── I. Fontes e cache ── */}
        <Section>
          <Label>I · Fontes de dados e arquitetura de cache</Label>
          <Card title="Cache-first — sem pipelines pesados em tempo real">
            <BulletList items={[
              "Dados CVM (DFP anual, Informe Mensal) são pré-processados offline e armazenados em cache local (src/data/*-cache/).",
              "As requisições do dashboard servem dados do cache — sem download ou parsing de arquivos CVM em tempo real.",
              "Cotações de mercado são obtidas via brapi e usadas apenas para contexto de preço, não para análise fundamentalista.",
              "Documentos CVM (DFP, ITR, FRE, fatos relevantes) são buscados no sistema ENET/CVM, com cache temporário para melhorar desempenho.",
              "Nenhum documento CVM é fabricado ou inventado — links apontam para o visualizador oficial da CVM (rad.cvm.gov.br).",
            ]} />
          </Card>
        </Section>

        {/* ── J. Limitações ── */}
        <Section>
          <Label>J · Limitações</Label>
          <Card title="O que a plataforma não cobre ou garante">
            <BulletList items={[
              "Dados podem estar incompletos ou ausentes para alguns ativos — a cobertura depende da disponibilidade e padronização dos dados CVM.",
              "Algumas contas contábeis não são perfeitamente padronizadas entre companhias ou fundos — divergências são esperadas.",
              "EBITDA usa EBIT como proxy quando D&A não está disponível como linha separada na DFP.",
              "Dívida total captura apenas as linhas 2.01.04 (CP) e 2.02.01 (LP) — debêntures em contas não padronizadas podem não ser incluídas.",
              "Tickers históricos ou descontinuados não são tratados como cobertura ativa.",
              "A plataforma processa apenas demonstrações consolidadas. ITR trimestral está disponível em beta para alguns ativos.",
              "A plataforma tem finalidade educacional e informacional — não é registrada como serviço de consultoria de valores mobiliários.",
            ]} />
          </Card>
        </Section>

        {/* ── Disclaimers ── */}
        <Disclaimers />

      </main>
    </div>
  );
}
