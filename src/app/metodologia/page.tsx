import React from "react";
import NavBar from "@/components/dashboard/NavBar";

// ─── Local layout components ──────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, letterSpacing: "0.8px",
      textTransform: "uppercase", color: "#94a3b8", marginBottom: 12,
    }}>
      {children}
    </div>
  );
}

function MethodologyCard({
  label,
  title,
  children,
}: {
  label?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{
      background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10,
      overflow: "hidden", marginBottom: 16,
    }}>
      <div style={{
        padding: "14px 22px 12px",
        borderBottom: "1px solid #f1f5f9",
      }}>
        {label && (
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: "0.7px",
            textTransform: "uppercase", color: "#94a3b8", marginBottom: 4,
          }}>
            {label}
          </div>
        )}
        <div style={{
          fontSize: 15, fontWeight: 700, color: "#0f172a", letterSpacing: "-0.2px",
        }}>
          {title}
        </div>
      </div>
      <div style={{ padding: "18px 22px" }}>
        {children}
      </div>
    </div>
  );
}

function FormulaBlock({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6,
      padding: "10px 14px", fontFamily: "'JetBrains Mono', monospace",
      fontSize: 12, color: "#0f172a", margin: "6px 0 10px",
      lineHeight: 1.9, overflowX: "auto",
    }}>
      {children}
    </div>
  );
}

function Prose({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      margin: "0 0 12px", fontSize: 14, color: "#374151", lineHeight: 1.75,
    }}>
      {children}
    </p>
  );
}

function StepList({ steps }: { steps: string[] }) {
  return (
    <ol style={{ margin: "0 0 4px", paddingLeft: 0, listStyle: "none" }}>
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

function IndicatorRow({
  name,
  formula,
  description,
}: {
  name: string;
  formula: string;
  description: string;
}) {
  return (
    <div style={{
      padding: "12px 0",
      borderBottom: "1px solid #f1f5f9",
    }}>
      <div style={{
        display: "flex", alignItems: "baseline", gap: 12, marginBottom: 4,
      }}>
        <span style={{
          fontSize: 13, fontWeight: 700, color: "#0f172a",
          fontFamily: "'JetBrains Mono', monospace", minWidth: 180, flexShrink: 0,
        }}>
          {name}
        </span>
      </div>
      <FormulaBlock>{formula}</FormulaBlock>
      <p style={{ margin: 0, fontSize: 13, color: "#374151", lineHeight: 1.6 }}>{description}</p>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function MetodologiaPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#f0f2f5" }}>
      <NavBar />

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "36px 24px 64px" }}>

        {/* Page header */}
        <div style={{ marginBottom: 32 }}>
          <SectionLabel>Documentação · Análise fundamentalista</SectionLabel>
          <h1 style={{
            margin: "0 0 10px", fontSize: 28, fontWeight: 800, color: "#0f172a",
            letterSpacing: "-0.6px", lineHeight: 1.2,
          }}>
            Metodologia de Análise
          </h1>
          <p style={{
            margin: 0, fontSize: 15, color: "#64748b", lineHeight: 1.65, maxWidth: 620,
          }}>
            Entenda como o Fundamental Copilot coleta, normaliza e apresenta dados
            fundamentalistas de empresas listadas na B3. Este documento descreve as fontes,
            os cálculos e as limitações da abordagem atual.
          </p>
        </div>

        {/* 1. Visão Geral */}
        <MethodologyCard label="Seção 1" title="Visão Geral">
          <Prose>
            O Fundamental Copilot BR apresenta análise fundamentalista de empresas da B3
            combinando quatro camadas de informação:
          </Prose>
          <BulletList items={[
            "Dados CVM — Demonstrações financeiras anuais extraídas da DFP consolidada publicada pela Comissão de Valores Mobiliários via CVM Dados Abertos.",
            "Indicadores calculados — Crescimento de receita, margens operacionais, geração de caixa livre, endividamento e múltiplos de mercado derivados dos dados primários.",
            "Diagnóstico baseado em regras — Observações objetivas sobre tendências nos dados, sem recomendações de compra ou venda.",
            "Múltiplos comparáveis — P/L, EV/EBITDA e EV/Receita de pares setoriais para contextualizar o preço relativo.",
          ]} />
          <div style={{
            marginTop: 16, background: "#fefce8", border: "1px solid #fde68a",
            borderRadius: 8, padding: "10px 14px",
            fontSize: 12, color: "#92400e", lineHeight: 1.6,
          }}>
            <strong>Nota:</strong> os dados apresentados têm finalidade educacional e
            demonstrativa. Nenhuma informação aqui constitui recomendação de investimento.
          </div>
        </MethodologyCard>

        {/* 2. Fonte de dados — CVM */}
        <MethodologyCard label="Seção 2" title="Fonte de Dados — CVM Dados Abertos">
          <Prose>
            Os dados financeiros provêm de demonstrações anuais consolidadas (DFP)
            publicadas na plataforma CVM Dados Abertos. O pipeline segue as etapas abaixo:
          </Prose>
          <StepList steps={[
            "Download do arquivo ZIP por ano fiscal diretamente de dados.cvm.gov.br (DFP anual consolidada).",
            "Parsing do CSV interno, filtrado pelo código CVM da empresa-alvo.",
            "Extração das linhas de interesse por código de conta: Receita Líquida (3.01), EBIT (3.05), Lucro Líquido (3.11), CFO (6.01), Capex (6.02), Caixa (1.01.01), Dívida curto prazo (2.01.04), Dívida longo prazo (2.02.01).",
            "Normalização para BRL bilhões, alinhamento por ano fiscal e montagem de um array de NormalizedFinancials com até 5 anos.",
            "Cache em memória por instância do servidor — o ZIP (~13 MB) é baixado apenas uma vez por ano fiscal por instância.",
          ]} />
          <div style={{
            marginTop: 12, background: "#eff6ff", border: "1px solid #bfdbfe",
            borderRadius: 8, padding: "10px 14px",
            fontSize: 12, color: "#1d4ed8", lineHeight: 1.6,
          }}>
            <strong>Capex:</strong> calculado como o valor absoluto da linha 6.02 da DFC
            (Aquisição de ativo imobilizado e intangível). FCL = CFO − Capex. Esses valores
            podem divergir de relatórios de analistas que usam critérios próprios de
            classificação de capex.
          </div>
        </MethodologyCard>

        {/* 3. Indicadores calculados */}
        <MethodologyCard label="Seção 3" title="Indicadores Calculados">
          <Prose>
            Todos os indicadores são calculados a partir do array de demonstrações normalizadas.
            Indicadores que exigem denominador zero ou dados ausentes retornam <code style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
              background: "#f1f5f9", padding: "1px 5px", borderRadius: 4,
            }}>null</code> e
            são exibidos como <strong>N/D</strong>.
          </Prose>

          <IndicatorRow
            name="CAGR Receita (3a)"
            formula={"CAGR = (Receita_ano3 / Receita_ano1) ^ (1 / 2) − 1"}
            description="Crescimento anual composto da receita nos últimos 3 anos disponíveis. Requer pelo menos 3 anos com receita positiva."
          />
          <IndicatorRow
            name="Crescimento YoY"
            formula={"YoY = (Receita_atual / Receita_anterior) − 1"}
            description="Crescimento da receita de um ano para o seguinte. Calculado para cada par de anos consecutivos disponível."
          />
          <IndicatorRow
            name="Margem EBIT"
            formula={"Margem EBIT = EBIT / Receita Líquida"}
            description="Percentual da receita convertido em resultado operacional antes de juros e impostos. Indica eficiência operacional e poder de precificação."
          />
          <IndicatorRow
            name="Margem Líquida"
            formula={"Margem Líquida = Lucro Líquido / Receita Líquida"}
            description="Percentual da receita que se converte em lucro após impostos, juros e despesas financeiras."
          />
          <IndicatorRow
            name="Margem FCL"
            formula={"Margem FCL = FCL / Receita Líquida\nFCL = CFO − Capex"}
            description="Percentual da receita convertido em fluxo de caixa livre. FCL negativo indica que a empresa ainda investe mais do que gera."
          />
          <IndicatorRow
            name="Conversão CFO/Lucro"
            formula={"Conversão = CFO / Lucro Líquido"}
            description="Relação entre caixa operacional gerado e lucro contábil. Valores acima de 1,0 indicam qualidade de lucro elevada; valores muito abaixo de 1,0 podem sinalizar diferenças entre resultado e caixa."
          />
          <IndicatorRow
            name="Dívida Líquida / EBIT"
            formula={"Dívida Líquida = Dívida Total − Caixa\nDívida Líquida / EBIT"}
            description="Número de anos de resultado operacional necessários para quitar a dívida líquida. Empresas com Dívida Líquida / EBIT abaixo de 2,0x são geralmente consideradas de baixa alavancagem."
          />
          <div style={{ paddingTop: 4 }}>
            <IndicatorRow
              name="P/L"
              formula={"P/L = Preço por ação / LPA\nLPA = Lucro Líquido / Ações em circulação"}
              description="Quantas vezes o mercado paga pelo lucro anual. Requer cotação em tempo real e lucro positivo."
            />
          </div>
        </MethodologyCard>

        {/* 4. Diagnóstico baseado em regras */}
        <MethodologyCard label="Seção 4" title="Diagnóstico Baseado em Regras">
          <Prose>
            O diagnóstico fundamentalista apresenta observações objetivas derivadas dos dados
            disponíveis. Não há modelo de linguagem, aprendizado de máquina nem recomendação
            de compra ou venda envolvidos. Cada sinal é gerado por uma regra determinística
            aplicada ao histórico normalizado:
          </Prose>
          <BulletList items={[
            "Crescimento de receita — verifica se CAGR (3a) é positivo e se há aceleração ou desaceleração recente entre os anos disponíveis.",
            "Tendência de margem EBIT — compara a margem EBIT do ano mais recente com a média dos anos anteriores para identificar expansão ou compressão.",
            "FCL positivo — verifica se o fluxo de caixa livre do ano mais recente é positivo, indicando autofinanciamento.",
            "Qualidade do lucro (CFO vs lucro líquido) — sinaliza quando o caixa operacional diverge significativamente do lucro contábil.",
            "Endividamento (Dívida Líquida / EBIT) — classifica o nível de alavancagem como baixo (< 2×), moderado (2–4×) ou elevado (> 4×).",
            "Limitações dos dados — informa quando há menos de 3 anos disponíveis, quando capex não está mapeado ou quando métricas essenciais estão ausentes.",
          ]} />
          <Prose>
            Os sinais são classificados em quatro categorias: <strong>Sinal positivo</strong>,{" "}
            <strong>Ponto de atenção</strong>, <strong>Neutro</strong> e{" "}
            <strong>Limitação dos dados</strong>. A linguagem adotada é descritiva — o sistema
            nunca sugere ação de investimento.
          </Prose>
        </MethodologyCard>

        {/* 5. Múltiplos */}
        <MethodologyCard label="Seção 5" title="Múltiplos Comparáveis">
          <Prose>
            A tabela de múltiplos exibe P/L, EV/EBITDA e EV/Receita de empresas
            comparáveis do mesmo setor. Os múltiplos funcionam como referência relativa
            de precificação — não são motor de análise principal, mas ajudam a contextualizar
            se os preços fazem sentido no universo do setor.
          </Prose>
          <BulletList items={[
            "P/L (Preço/Lucro): quantas vezes o mercado paga pelo lucro anual. Útil para comparar empresas lucrativas dentro do mesmo setor.",
            "EV/EBITDA (Enterprise Value sobre EBITDA): compara o valor total da firma com sua geração operacional antes de depreciação. Amplamente usado em análise setorial.",
            "EV/Receita (Enterprise Value sobre Receita): compara o valor da firma com a receita bruta. Relevante para empresas de alto crescimento ou margens em expansão.",
          ]} />
        </MethodologyCard>

        {/* 6. Elegibilidade para análise CVM */}
        <MethodologyCard label="Seção 6" title="Critérios de Elegibilidade para Análise CVM">
          <Prose>
            Nem todos os ativos com mapeamento CVM são elegíveis para análise automática.
            Os critérios mínimos são:
          </Prose>
          <BulletList items={[
            "O ativo deve ter status cvm_financials ou cvm_analysis no universo de cobertura.",
            "O histórico CVM deve conter ao menos 3 anos fiscais com dados válidos.",
            "A receita líquida deve ser positiva em pelo menos um dos anos disponíveis.",
            "Ao menos uma métrica utilizável (receita, EBIT ou CFO) deve estar presente.",
            "Valores todos zerados em todas as linhas indicam mapeamento inválido — o ativo cai em fallback.",
          ]} />
          <Prose>
            Quando o ativo não atende aos critérios, o sistema exibe a razão de não
            elegibilidade e utiliza dados ilustrativos como fallback, informando o usuário
            pelo DataSourceNotice.
          </Prose>
        </MethodologyCard>

        {/* 7. Limitações */}
        <MethodologyCard label="Seção 7" title="Limitações da Abordagem Atual">
          <BulletList items={[
            "Os dados financeiros dos 5 ativos com análise completa (WEGE3, ABEV3, EGIE3, CPFE3, VIVT3) são ilustrativos — plausíveis mas não auditados contra demonstrações reais.",
            "EBITDA usa EBIT como proxy quando D&A não está disponível como linha separada na DFP.",
            "Dívida total é capturada como 2.01.04 (curto prazo) + 2.02.01 (longo prazo). Debêntures em contas não padronizadas podem não ser capturadas.",
            "Bancos, seguradoras, FIIs, ETFs e BDRs requerem metodologia específica (DDM, NAV, Excess Return) — o modelo fundamentalista padrão não se aplica a esses setores.",
            "Apenas demonstrações consolidadas são processadas. ITR trimestral ainda não está implementado.",
            "O app suporta apenas o método FIFO de capex (linha 6.02). Empresas com capex distribuído em múltiplas linhas podem ter valores subestimados.",
            "A plataforma não fornece recomendações de investimento e não é registrada como serviço de consultoria de valores mobiliários.",
          ]} />
        </MethodologyCard>

        {/* 8. Aviso Legal */}
        <div style={{
          background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10,
          overflow: "hidden",
        }}>
          <div style={{
            padding: "10px 22px",
            background: "#f8fafc",
            borderBottom: "1px solid #e2e8f0",
            fontSize: 10, fontWeight: 700, letterSpacing: "0.7px",
            textTransform: "uppercase" as const, color: "#94a3b8",
          }}>
            Aviso Legal
          </div>
          <div style={{ padding: "18px 22px" }}>
            <p style={{
              margin: 0, fontSize: 13, color: "#374151", lineHeight: 1.75,
            }}>
              Este projeto tem finalidade educacional e demonstrativa. As informações
              apresentadas não constituem recomendação de investimento, oferta de compra
              ou venda de valores mobiliários, nem substituem análise profissional
              independente. Investimentos em renda variável envolvem riscos e podem
              resultar em perdas. Consulte um profissional certificado antes de tomar
              decisões de investimento.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
