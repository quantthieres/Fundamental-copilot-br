import React from "react";

interface Props {
  sourceMode: "mock" | "cvm" | "cvm_analysis";
  hasCvmData?: boolean;
  quoteSource?: "brapi" | "mock" | null;
}

interface BadgeStyle { bg: string; color: string }

const BS = {
  cvm:        { bg: "#eff6ff", color: "#2563eb" },
  calculated: { bg: "#f0fdf4", color: "#16a34a" },
  mock:       { bg: "#f8fafc", color: "#64748b" },
  brapi:      { bg: "#ecfdf5", color: "#059669" },
  warn:       { bg: "#fffbeb", color: "#b45309" },
} satisfies Record<string, BadgeStyle>;

function Chip({ text, s }: { text: string; s: BadgeStyle }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      background: s.bg, color: s.color,
      fontSize: 10, fontWeight: 700, padding: "2px 7px",
      borderRadius: 4, letterSpacing: "0.3px", whiteSpace: "nowrap" as const,
      fontFamily: "'JetBrains Mono', 'Courier New', monospace",
    }}>
      {text}
    </span>
  );
}

export default function DataSourceNotice({ sourceMode, hasCvmData, quoteSource }: Props) {
  const quoteStyle = quoteSource === "brapi" ? BS.brapi : BS.mock;
  const quoteLabel = quoteSource === "brapi" ? "Cotação: brapi" : "Cotação: mock";

  if (sourceMode === "cvm_analysis") {
    return (
      <div style={card("#ddd6fe")}>
        <Row>
          <Title color="#5b21b6">Análise fundamentalista · Dados CVM</Title>
          <Chips>
            <Chip text="Receita: CVM"          s={BS.cvm} />
            <Chip text="EBIT: CVM"             s={BS.cvm} />
            <Chip text="FCF: Calculado"        s={BS.calculated} />
            <Chip text="Dívida: Calculada"     s={BS.calculated} />
            <Chip text={quoteLabel}            s={quoteStyle} />
          </Chips>
        </Row>
        <Body>
          Dados financeiros extraídos da DFP anual consolidada (CVM Dados Abertos).
          Alguns campos são normalizados ou calculados a partir das demonstrações.
          Não constitui recomendação de investimento.
        </Body>
      </div>
    );
  }

  if (sourceMode === "mock") {
    return (
      <div style={card()}>
        <Row>
          <Title>Dados ilustrativos</Title>
          <Chips>
            <Chip text="Financeiros: ilustrativos" s={BS.mock} />
            <Chip text={quoteLabel} s={quoteStyle} />
          </Chips>
        </Row>
        <Body>
          Este painel está usando dados ilustrativos para demonstração. Use o modo{" "}
          <strong style={{ fontWeight: 600 }}>Dados CVM</strong> para visualizar dados
          oficiais normalizados da DFP anual quando disponíveis.
        </Body>
      </div>
    );
  }

  if (!hasCvmData) {
    return (
      <div style={card("#fde68a")}>
        <Row>
          <Title color="#b45309">Modo CVM — dados não disponíveis</Title>
          <Chips>
            <Chip text="Financeiros: ilustrativos (fallback)" s={BS.warn} />
            <Chip text={quoteLabel} s={quoteStyle} />
          </Chips>
        </Row>
        <Body>
          Não há mapeamento CVM confirmado para este ticker. O painel continua usando dados
          ilustrativos como fallback.
        </Body>
      </div>
    );
  }

  return (
    <div style={card("#bfdbfe")}>
      <Row>
        <Title color="#1d4ed8">Modo CVM ativo</Title>
        <Chips>
          <Chip text="Receita: CVM"          s={BS.cvm} />
          <Chip text="EBIT: CVM"             s={BS.cvm} />
          <Chip text="FCF: Calculado"        s={BS.calculated} />
          <Chip text="Dívida líquida: Calc." s={BS.calculated} />
          <Chip text={quoteLabel}            s={quoteStyle} />
        </Chips>
      </Row>
      <Body>
        Este painel está usando dados extraídos da DFP anual consolidada da CVM. Capex, FCF
        e dívida líquida são campos normalizados ou calculados a partir das demonstrações.
        EBITDA pode usar EBIT como proxy quando D&A não estiver disponível.
      </Body>
    </div>
  );
}

// ─── layout primitives ───────────────────────────────────────────────────────

function card(borderColor = "#e2e8f0"): React.CSSProperties {
  return {
    background: "#fff", border: `1px solid ${borderColor}`, borderRadius: 10,
    padding: "12px 16px", marginBottom: 14,
  };
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", justifyContent: "space-between",
      gap: 10, marginBottom: 6, flexWrap: "wrap",
    }}>
      {children}
    </div>
  );
}

function Title({ children, color = "#374151" }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{ fontSize: 12, fontWeight: 650, color, letterSpacing: "-0.1px" }}>
      {children}
    </span>
  );
}

function Chips({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {children}
    </div>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ margin: 0, fontSize: 12, color: "#64748b", lineHeight: 1.6 }}>
      {children}
    </p>
  );
}
