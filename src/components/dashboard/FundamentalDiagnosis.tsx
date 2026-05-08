import React from "react";
import SectionCard from "./SectionCard";
import type { NormalizedFinancials } from "@/lib/cvm/types";

interface Props {
  financials: NormalizedFinancials[];
}

type SignalType = "positive" | "attention" | "neutral" | "limitation";

interface Observation {
  type: SignalType;
  text: string;
}

const SIGNAL_CONFIG: Record<SignalType, { label: string; bg: string; color: string; border: string }> = {
  positive:   { label: "Sinal positivo",    bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" },
  attention:  { label: "Ponto de atenção",  bg: "#fffbeb", color: "#b45309", border: "#fde68a" },
  neutral:    { label: "Neutro",            bg: "#f8fafc", color: "#475569", border: "#e2e8f0" },
  limitation: { label: "Limitação dos dados", bg: "#f1f5f9", color: "#64748b", border: "#e2e8f0" },
};

function buildObservations(financials: NormalizedFinancials[]): Observation[] {
  const obs: Observation[] = [];

  if (financials.length < 3) {
    obs.push({ type: "limitation", text: `Menos de 3 anos de dados disponíveis (${financials.length} encontrado${financials.length !== 1 ? "s" : ""}).` });
    return obs;
  }

  const sorted = [...financials].sort((a, b) => b.fiscalYear - a.fiscalYear);
  const latest = sorted[0];
  const prev   = sorted[1];

  // Revenue
  if (latest.revenue === undefined || latest.revenue === 0) {
    obs.push({ type: "limitation", text: "Receita ausente ou zerada no último ano. Dados CVM podem estar incompletos." });
  } else if (prev.revenue !== undefined && prev.revenue > 0) {
    if (latest.revenue > prev.revenue) {
      obs.push({ type: "positive",   text: "Receita cresceu no último ano." });
    } else {
      obs.push({ type: "attention",  text: "Receita caiu no último ano." });
    }
  } else {
    obs.push({ type: "neutral", text: "Receita disponível apenas para o último ano; evolução não calculável." });
  }

  // EBIT margin
  if (latest.ebit !== undefined && latest.revenue && latest.revenue > 0 &&
      prev.ebit   !== undefined && prev.revenue   && prev.revenue   > 0) {
    const marginLatest = latest.ebit / latest.revenue;
    const marginPrev   = prev.ebit   / prev.revenue;
    if (marginLatest > marginPrev) {
      obs.push({ type: "positive",  text: "Margem EBIT expandiu em relação ao ano anterior." });
    } else if (marginLatest < marginPrev) {
      obs.push({ type: "attention", text: "Margem EBIT comprimiu em relação ao ano anterior." });
    } else {
      obs.push({ type: "neutral",   text: "Margem EBIT estável em relação ao ano anterior." });
    }
  } else {
    obs.push({ type: "limitation", text: "Dados insuficientes para calcular evolução da margem EBIT." });
  }

  // FCF
  if (latest.freeCashFlow !== undefined) {
    if (latest.freeCashFlow > 0) {
      obs.push({ type: "positive",  text: "FCF positivo no último ano." });
    } else {
      obs.push({ type: "attention", text: "FCF negativo no último ano." });
    }
  } else {
    obs.push({ type: "limitation", text: "Fluxo de caixa livre não disponível." });
  }

  // CFO vs net income
  if (latest.operatingCashFlow !== undefined && latest.netIncome !== undefined && latest.netIncome > 0) {
    if (latest.operatingCashFlow >= latest.netIncome) {
      obs.push({ type: "positive",  text: "Caixa operacional (CFO) igual ou superior ao lucro líquido." });
    } else {
      obs.push({ type: "attention", text: "CFO ficou abaixo do lucro líquido — qualidade do lucro merece atenção." });
    }
  }

  // Debt vs EBIT
  if (latest.netDebt !== undefined && latest.ebit !== undefined && latest.ebit > 0) {
    const ratio = latest.netDebt / latest.ebit;
    if (ratio <= 2) {
      obs.push({ type: "positive",  text: `Dívida líquida é inferior a 2× o EBIT anual (${ratio.toFixed(1)}×).` });
    } else if (ratio <= 4) {
      obs.push({ type: "attention", text: `Dívida líquida entre 2× e 4× o EBIT anual (${ratio.toFixed(1)}×).` });
    } else {
      obs.push({ type: "attention", text: `Dívida líquida supera 4× o EBIT anual (${ratio.toFixed(1)}×).` });
    }
  } else if (latest.netDebt !== undefined && (latest.netDebt < 0)) {
    obs.push({ type: "positive", text: "Empresa possui posição de caixa líquido (sem dívida líquida)." });
  }

  return obs;
}

export default function FundamentalDiagnosis({ financials }: Props) {
  const observations = buildObservations(financials);

  return (
    <SectionCard title="Diagnóstico Fundamentalista" subtitle="Observações objetivas baseadas em regras — sem recomendação de investimento">
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {observations.map((obs, i) => {
          const cfg = SIGNAL_CONFIG[obs.type];
          return (
            <div key={i} style={{
              display: "flex", alignItems: "flex-start", gap: 10,
              background: cfg.bg, border: `1px solid ${cfg.border}`,
              borderRadius: 8, padding: "9px 12px",
            }}>
              <span style={{
                fontSize: 10, fontWeight: 700, color: cfg.color,
                background: "transparent", whiteSpace: "nowrap",
                letterSpacing: "0.2px", paddingTop: 1, flexShrink: 0,
              }}>
                {cfg.label}
              </span>
              <span style={{ fontSize: 13, color: "#374151", lineHeight: 1.5 }}>
                {obs.text}
              </span>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 14, fontSize: 11, color: "#94a3b8", lineHeight: 1.6 }}>
        Observações geradas automaticamente a partir de regras objetivas aplicadas aos dados CVM.
        Não representa recomendação de compra, venda ou manutenção de ativo.
      </div>
    </SectionCard>
  );
}
