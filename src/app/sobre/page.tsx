import React from "react";
import NavBar from "@/components/dashboard/NavBar";
import { COVERAGE_BADGE, COVERAGE_DESCRIPTION, type CoverageStatus } from "@/data/coverage-types";

// ─── Local layout primitives ──────────────────────────────────────────────────

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

function Card({
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
      <div style={{ padding: "14px 22px 12px", borderBottom: "1px solid #f1f5f9" }}>
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

function BulletList({ items }: { items: (string | React.ReactNode)[] }) {
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

function CheckList({ items }: { items: string[] }) {
  return (
    <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
      {items.map((item, i) => (
        <li key={i} style={{
          display: "flex", alignItems: "flex-start", gap: 10, padding: "7px 0",
          borderBottom: i < items.length - 1 ? "1px solid #f8fafc" : "none",
        }}>
          <span style={{
            flexShrink: 0, width: 18, height: 18, borderRadius: 4,
            background: "#dcfce7", display: "flex", alignItems: "center",
            justifyContent: "center", marginTop: 1,
          }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1.5 5L3.8 7.5L8.5 2.5" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
          <span style={{ fontSize: 14, color: "#374151", lineHeight: 1.6 }}>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function RoadmapList({ items }: { items: string[] }) {
  return (
    <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
      {items.map((item, i) => (
        <li key={i} style={{
          display: "flex", alignItems: "flex-start", gap: 10, padding: "7px 0",
          borderBottom: i < items.length - 1 ? "1px solid #f8fafc" : "none",
        }}>
          <span style={{
            flexShrink: 0, width: 18, height: 18, borderRadius: "50%",
            border: "1.5px solid #cbd5e1", display: "flex", alignItems: "center",
            justifyContent: "center", marginTop: 1,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#cbd5e1", display: "block" }} />
          </span>
          <span style={{ fontSize: 14, color: "#374151", lineHeight: 1.6 }}>{item}</span>
        </li>
      ))}
    </ul>
  );
}

// ─── Feature grid ─────────────────────────────────────────────────────────────

function FeatureGrid({ features }: { features: { icon: string; title: string; body: string }[] }) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "repeat(2, 1fr)",
      gap: 12,
    }}>
      {features.map((f, i) => (
        <div key={i} style={{
          background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "14px 16px",
        }}>
          <div style={{ fontSize: 18, marginBottom: 6 }}>{f.icon}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>{f.title}</div>
          <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.55 }}>{f.body}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Data source block ────────────────────────────────────────────────────────

function DataSourceRow({
  label,
  labelBg,
  labelColor,
  title,
  description,
  note,
}: {
  label: string;
  labelBg: string;
  labelColor: string;
  title: string;
  description: string;
  note?: string;
}) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "120px 1fr",
      gap: 16, padding: "14px 0",
      borderBottom: "1px solid #f1f5f9", alignItems: "start",
    }}>
      <div>
        <span style={{
          display: "inline-block", fontSize: 11, fontWeight: 700,
          padding: "3px 9px", borderRadius: 20,
          background: labelBg, color: labelColor,
        }}>
          {label}
        </span>
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.65 }}>{description}</div>
        {note && (
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>{note}</div>
        )}
      </div>
    </div>
  );
}

// ─── Coverage status list ─────────────────────────────────────────────────────

const COVERAGE_STATUS_ORDER: CoverageStatus[] = [
  "full_analysis",
  "cvm_analysis",
  "cvm_financials",
  "quote_only",
  "sector_specific_model_required",
  "unavailable",
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SobrePage() {
  return (
    <div style={{ minHeight: "100vh", background: "#f0f2f5" }}>
      <NavBar />

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "36px 24px 64px" }}>

        {/* 1. Hero */}
        <div style={{ marginBottom: 32 }}>
          <SectionLabel>Fundamental Copilot BR · Plataforma</SectionLabel>
          <h1 style={{
            margin: "0 0 10px", fontSize: 28, fontWeight: 800, color: "#0f172a",
            letterSpacing: "-0.6px", lineHeight: 1.2,
          }}>
            Sobre o Fundamental Copilot BR
          </h1>
          <p style={{
            margin: "0 0 16px", fontSize: 15, color: "#64748b", lineHeight: 1.65, maxWidth: 640,
          }}>
            Uma plataforma experimental para análise fundamentalista automatizada de empresas
            brasileiras listadas na B3.
          </p>
          <p style={{
            margin: 0, fontSize: 14, color: "#374151", lineHeight: 1.75, maxWidth: 680,
          }}>
            O projeto combina dados de mercado e demonstrações financeiras da CVM em uma
            interface de research que automatiza a coleta, normalização e apresentação de
            indicadores fundamentalistas. O objetivo é oferecer uma experiência próxima a
            uma ferramenta profissional de equity research — mais acessível, transparente
            e focada em dados verificáveis.
          </p>
        </div>

        {/* 2. O que o produto faz */}
        <Card label="Seção 1" title="O que o produto faz">
          <Prose>
            A plataforma reúne dados de diferentes fontes e os apresenta em uma interface
            unificada voltada para análise fundamentalista:
          </Prose>
          <FeatureGrid features={[
            {
              icon: "🔍",
              title: "Busca de ativos da B3",
              body: "Universo de ~170 ativos pesquisável por ticker, nome ou setor. Cada ativo exibe seu status de cobertura diretamente no dropdown.",
            },
            {
              icon: "📈",
              title: "Cotações reais via brapi",
              body: "Preço atual, variação diária e market cap quando disponíveis. Dados fornecidos por brapi.dev via rota interna do servidor.",
            },
            {
              icon: "🏛️",
              title: "Dados financeiros CVM / DFP anual",
              body: "Receita, EBIT, lucro líquido, CFO, capex, FCL, caixa, dívida total e dívida líquida — normalizados para BRL bilhões por ano fiscal.",
            },
            {
              icon: "📊",
              title: "Indicadores fundamentalistas",
              body: "CAGR de receita, margens operacionais, margem FCL, conversão CFO/lucro, dívida líquida/EBIT e múltiplos de mercado calculados automaticamente.",
            },
            {
              icon: "🔬",
              title: "Diagnóstico baseado em regras",
              body: "Observações objetivas sobre crescimento, margens, caixa e endividamento. Sem recomendações de compra ou venda.",
            },
            {
              icon: "🔢",
              title: "Múltiplos comparáveis",
              body: "P/L, EV/EBITDA e EV/Receita de empresas do mesmo setor como referência relativa de precificação.",
            },
            {
              icon: "📰",
              title: "Painel de notícias",
              body: "Notícias recentes e documentos relevantes por empresa. Integração com fontes externas planejada para versões futuras.",
            },
            {
              icon: "🔎",
              title: "Transparência de fontes de dados",
              body: "DataSourceNotice indica claramente quais campos vêm de CVM, quais são calculados e quais são dados ilustrativos — antes de qualquer uso em análise.",
            },
          ]} />
        </Card>

        {/* 3. Fontes de dados */}
        <Card label="Seção 2" title="Fontes de dados">
          <Prose>
            O app integra três origens de dados com comportamentos diferentes.
            Nenhuma delas é considerada completamente validada nesta versão.
          </Prose>
          <div>
            <DataSourceRow
              label="brapi"
              labelBg="#dbeafe"
              labelColor="#1d4ed8"
              title="Cotação e dados de mercado"
              description="Preço atual, variação percentual diária e market cap (quando disponível). Acessado via rota interna do servidor usando BRAPI_TOKEN. Sem token, o app opera normalmente com dados ilustrativos."
              note="Variável de ambiente: BRAPI_TOKEN. Nunca exposta no cliente."
            />
            <DataSourceRow
              label="CVM Dados Abertos"
              labelBg="#dcfce7"
              labelColor="#15803d"
              title="DFP anual consolidada — demonstrações financeiras oficiais"
              description="Dados baixados diretamente de dados.cvm.gov.br. Inclui DRE, DFC (método indireto ou direto) e Balanço Patrimonial dos anos 2020–2024. Valores normalizados para BRL bilhões. Disponível para empresas com mapeamento verificado."
              note="Acesso em: /api/cvm/financials/[ticker]. Capex e FCL são calculados a partir de linhas da DFC — podem divergir de relatórios de analistas."
            />
            <DataSourceRow
              label="Mock"
              labelBg="#f1f5f9"
              labelColor="#475569"
              title="Dados ilustrativos para demonstração e fallback"
              description="Usados nas empresas com análise completa (WEGE3, ABEV3, EGIE3, CPFE3, VIVT3). Valores plausíveis mas não auditados. Servem para demonstrar o layout e os indicadores sem depender de APIs externas."
              note="O dashboard principal utiliza dados CVM quando disponíveis e elegíveis; caso contrário, exibe dados ilustrativos com fallback explícito."
            />
          </div>
          <div style={{
            marginTop: 14, background: "#fefce8", border: "1px solid #fde68a",
            borderRadius: 8, padding: "10px 14px",
            fontSize: 12, color: "#92400e", lineHeight: 1.6,
          }}>
            <strong>Transparência:</strong> o DataSourceNotice exibido no dashboard
            detalha a origem de cada campo — Receita, EBIT, FCL, Dívida líquida e Cotação —
            incluindo o que é calculado versus o que vem diretamente de uma fonte primária.
          </div>
        </Card>

        {/* 4. Status de cobertura */}
        <Card label="Seção 3" title="Status de cobertura">
          <Prose>
            Cada ativo no universo de busca carrega um <code style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
              background: "#f1f5f9", padding: "1px 5px", borderRadius: 4,
            }}>coverageStatus</code> que
            indica o que a plataforma suporta atualmente para aquele ticker.
            O status aparece como badge colorido no dropdown de busca e define
            a experiência de empty state quando um ativo sem análise completa é selecionado.
          </Prose>
          <div>
            {COVERAGE_STATUS_ORDER.map((status, i) => {
              const badge = COVERAGE_BADGE[status];
              const desc  = COVERAGE_DESCRIPTION[status];
              return (
                <div key={status} style={{
                  display: "flex", alignItems: "flex-start", gap: 14, padding: "12px 0",
                  borderBottom: i < COVERAGE_STATUS_ORDER.length - 1 ? "1px solid #f1f5f9" : "none",
                }}>
                  <span style={{
                    flexShrink: 0, fontSize: 11, fontWeight: 600,
                    padding: "3px 9px", borderRadius: 20, marginTop: 1,
                    background: badge.bg, color: badge.color, whiteSpace: "nowrap",
                  }}>
                    {badge.label}
                  </span>
                  <span style={{ fontSize: 13, color: "#374151", lineHeight: 1.65 }}>
                    {desc}
                  </span>
                </div>
              );
            })}
          </div>
          <div style={{
            marginTop: 14, background: "#f8fafc", border: "1px solid #e2e8f0",
            borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#64748b", lineHeight: 1.6,
          }}>
            Cobertura atual aproximada: 5 ativos com Análise completa · 27 com Análise CVM ·
            3 com Dados CVM · ~29 com Modelo específico (bancos, FIIs, ETFs) · 98 com Cotação.
          </div>
        </Card>

        {/* 5. O que já está implementado */}
        <Card label="Seção 4" title="O que já está implementado">
          <CheckList items={[
            "Dashboard em Next.js 15 com App Router — componentizado, tipado com TypeScript",
            "Universo de busca com ~170 ativos da B3 pesquisável por ticker, nome e setor",
            "Indicadores fundamentalistas calculados automaticamente (crescimento, margens, endividamento, múltiplos)",
            "Diagnóstico baseado em regras — sinais objetivos sobre tendências nos dados",
            "Tabela de múltiplos comparáveis setoriais",
            "Integração com brapi.dev para cotações em tempo real (server-side, token protegido)",
            "Endpoint CVM DFP — download, parsing e normalização de DFP anual (2020–2024)",
            "Modo Dados CVM — análise fundamentalista com dados reais quando disponíveis",
            "DataSourceNotice — identifica a origem de cada campo antes do uso em análise",
            "Página de metodologia — explica fonte de dados, cálculos de indicadores, diagnóstico e limitações",
            "Página Sobre (esta página)",
            "Página de cobertura — lista todos os ativos com status e filtros",
          ]} />
        </Card>

        {/* 6. Limitações atuais */}
        <Card label="Seção 5" title="Limitações atuais">
          <BulletList items={[
            "Os dados financeiros das empresas com análise completa (WEGE3, ABEV3, EGIE3, CPFE3, VIVT3) são ilustrativos — plausíveis, mas não auditados contra demonstrações reais.",
            "Os dados CVM ainda estão em validação empresa por empresa. Capex e FCL são calculados a partir de linhas da DFC e podem divergir de relatórios de analistas externos.",
            "EBITDA usa EBIT como proxy quando D&A não está disponível como linha separada na DFP.",
            "Dívida total é capturada como 2.01.04 (curto prazo) + 2.02.01 (longo prazo). Debêntures em contas não padronizadas podem não ser capturadas.",
            "Bancos, seguradoras, FIIs, ETFs, BDRs e holdings requerem modelos setoriais específicos — DDM, NAV, Excess Return Model — que não estão implementados nesta versão.",
            "O app suporta apenas demonstrações consolidadas (não individuais) e apenas dados anuais (sem ITR trimestral).",
            "Cold start: a primeira requisição por ano fiscal baixa um zip de ~13 MB da CVM (1–3 segundos). Requisições subsequentes são servidas do cache em memória.",
            "O universo de busca tem ~170 ativos; cobertura ampla da B3 ainda está em expansão.",
            "A plataforma não fornece recomendações de investimento e não é registrada como serviço de consultoria de valores mobiliários.",
          ]} />
        </Card>

        {/* 7. Roadmap */}
        <Card label="Seção 6" title="Próximos passos">
          <Prose>
            Funcionalidades planejadas, em ordem aproximada de prioridade:
          </Prose>
          <RoadmapList items={[
            "Ampliar cobertura CVM — mapear mais tickers ao registro da CVM Dados Abertos",
            "Validar normalização por setor — confirmar receita, EBIT e capex para utilities, varejo, telecom e mineração",
            "Integrar ITR trimestral — dados de DRE e DFC com periodicidade trimestral",
            "Melhorar modelos setoriais — implementar DDM para bancos e utilidades, NAV para FIIs",
            "Adicionar histórico de preço — séries de cotação para gráficos de desempenho",
            "Relatório exportável — snapshot fundamentalista em PDF com layout estruturado",
            "Ampliar testes automatizados — cobertura do normalizer CVM, indicadores e diagnóstico",
            "Integração com fontes de notícias — alertas de fatos relevantes e comunicados por ticker",
          ]} />
        </Card>

        {/* 8. Disclaimer */}
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
            <p style={{ margin: 0, fontSize: 13, color: "#374151", lineHeight: 1.75 }}>
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
