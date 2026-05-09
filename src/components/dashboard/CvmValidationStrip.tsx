"use client";

import { useState, useEffect } from "react";

const STEPS = [
  "Identificando empresa",
  "Buscando demonstrações financeiras",
  "Normalizando dados",
  "Atualizando indicadores",
] as const;

// Thresholds (ms) to advance each step while loading
const STEP_DELAYS = [0, 2500, 7000, 13000];
const STEP_PROGRESS = [8, 28, 58, 82];

export type CvmStripStatus = "loading" | "error" | "insufficient";

interface Props {
  ticker: string;
  status: CvmStripStatus;
  insufficiencyReason?: string | null;
}

export default function CvmValidationStrip({ ticker, status, insufficiencyReason }: Props) {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (status !== "loading") return;
    setCurrentStep(0);
    const timers = STEP_DELAYS.slice(1).map((delay, i) =>
      setTimeout(() => setCurrentStep(i + 1), delay),
    );
    return () => timers.forEach(clearTimeout);
  }, [ticker, status]);

  if (status === "error") {
    return (
      <Notice
        bg="#fef2f2" border="#fecaca"
        badge={{ text: "CVM", bg: "#fee2e2", color: "#991b1b" }}
        headline="Não foi possível carregar dados CVM no momento."
        detail="O painel exibe apenas dados de mercado disponíveis."
      />
    );
  }

  if (status === "insufficient") {
    return (
      <Notice
        bg="#fffbeb" border="#fde68a"
        badge={{ text: "CVM", bg: "#fef3c7", color: "#92400e" }}
        headline="Dados CVM indisponíveis ou insuficientes para este ativo."
        detail={
          insufficiencyReason
            ? `Motivo: ${insufficiencyReason}.`
            : "O painel exibe apenas dados de mercado disponíveis."
        }
      />
    );
  }

  const progress = STEP_PROGRESS[currentStep] ?? STEP_PROGRESS[STEP_PROGRESS.length - 1];

  return (
    <div style={{
      background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 10,
      padding: "14px 18px", marginBottom: 14,
    }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{
          fontSize: 9, fontWeight: 700, letterSpacing: "0.6px",
          textTransform: "uppercase" as const,
          color: "#0369a1", background: "#e0f2fe",
          padding: "2px 7px", borderRadius: 4,
        }}>
          Validação CVM
        </span>
        <span style={{ fontSize: 12, color: "#0369a1" }}>
          Consultando dados oficiais em segundo plano...
        </span>
      </div>

      {/* Progress bar */}
      <div style={{
        background: "#e0f2fe", borderRadius: 99, height: 3,
        marginBottom: 10, overflow: "hidden",
      }}>
        <div style={{
          height: "100%", borderRadius: 99,
          background: "linear-gradient(90deg, #0284c7, #38bdf8)",
          width: `${progress}%`,
          transition: "width 0.7s ease",
        }} />
      </div>

      {/* Step pills */}
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap" as const, gap: 6 }}>
        {STEPS.map((step, i) => {
          const done   = i < currentStep;
          const active = i === currentStep;
          return (
            <span key={step} style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              fontSize: 11,
              color: done ? "#0369a1" : active ? "#0284c7" : "#7dd3fc",
              fontWeight: active ? 600 : 400,
            }}>
              <span style={{ fontSize: 9 }}>
                {done ? "✓" : active ? "●" : "○"}
              </span>
              {step}
              {i < STEPS.length - 1 && (
                <span style={{ color: "#bae6fd", marginLeft: 2 }}>›</span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ─── Shared notice sub-component ─────────────────────────────────────────────

function Notice({
  bg, border, badge, headline, detail,
}: {
  bg: string; border: string;
  badge: { text: string; bg: string; color: string };
  headline: string;
  detail: string;
}) {
  return (
    <div style={{
      background: bg, border: `1px solid ${border}`, borderRadius: 10,
      padding: "12px 16px", marginBottom: 14,
      display: "flex", alignItems: "flex-start", gap: 10,
    }}>
      <span style={{
        fontSize: 9, fontWeight: 700, letterSpacing: "0.6px",
        textTransform: "uppercase" as const,
        background: badge.bg, color: badge.color,
        padding: "3px 7px", borderRadius: 4, flexShrink: 0, marginTop: 1,
      }}>
        {badge.text}
      </span>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 2 }}>
          {headline}
        </div>
        <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.5 }}>
          {detail}
        </div>
      </div>
    </div>
  );
}
