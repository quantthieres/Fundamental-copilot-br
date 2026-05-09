"use client";

import { useState, useEffect } from "react";

const STEPS = [
  "Identificando empresa na CVM",
  "Buscando demonstrações financeiras",
  "Normalizando dados contábeis",
  "Calculando indicadores",
  "Carregando documentos oficiais",
] as const;

// Thresholds (ms) at which each step becomes active
const STEP_DELAYS = [0, 1800, 4000, 6500, 9500];

// Progress bar width (%) at each step — never reaches 100 while loading
const STEP_PROGRESS = [10, 30, 52, 72, 85];

interface AnalysisLoadingStateProps {
  ticker: string;
}

export default function AnalysisLoadingState({ ticker }: AnalysisLoadingStateProps) {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    setCurrentStep(0);
    const timers = STEP_DELAYS.slice(1).map((delay, i) =>
      setTimeout(() => setCurrentStep(i + 1), delay),
    );
    return () => timers.forEach(clearTimeout);
  }, [ticker]);

  const progress = STEP_PROGRESS[currentStep];

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "72px 24px",
    }}>
      <div style={{
        background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14,
        padding: "40px 48px", maxWidth: 480, width: "100%",
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
      }}>
        {/* Header */}
        <div style={{ marginBottom: 26 }}>
          <div style={{
            display: "inline-block",
            fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700,
            color: "#2563eb", background: "#dbeafe",
            padding: "3px 10px", borderRadius: 6,
            letterSpacing: "0.5px", marginBottom: 14,
          }}>
            {ticker}
          </div>
          <h2 style={{
            margin: 0, fontSize: 17, fontWeight: 700, color: "#0f172a", lineHeight: 1.35,
          }}>
            Preparando análise de {ticker}
          </h2>
          <p style={{
            margin: "8px 0 0", fontSize: 13, color: "#64748b", lineHeight: 1.55,
          }}>
            Estamos consultando dados CVM, mercado e documentos oficiais.
          </p>
        </div>

        {/* Progress bar */}
        <div style={{
          background: "#f1f5f9", borderRadius: 99, height: 5,
          marginBottom: 26, overflow: "hidden",
        }}>
          <div style={{
            height: "100%", borderRadius: 99,
            background: "linear-gradient(90deg, #1d4ed8 0%, #3b82f6 100%)",
            width: `${progress}%`,
            transition: "width 0.7s cubic-bezier(0.4, 0, 0.2, 1)",
          }} />
        </div>

        {/* Step checklist */}
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          {STEPS.map((step, i) => {
            const done = i < currentStep;
            const active = i === currentStep;
            return (
              <div key={step} style={{ display: "flex", alignItems: "center", gap: 11 }}>
                {/* Step indicator */}
                <div style={{
                  width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: done ? 11 : 8,
                  background: done ? "#dbeafe" : active ? "#eff6ff" : "#f8fafc",
                  border: done
                    ? "1.5px solid #93c5fd"
                    : active
                    ? "1.5px solid #3b82f6"
                    : "1.5px solid #e2e8f0",
                  color: done ? "#2563eb" : active ? "#3b82f6" : "#cbd5e1",
                  fontWeight: 700,
                }}>
                  {done ? "✓" : active ? "●" : ""}
                </div>

                {/* Label */}
                <span style={{
                  fontSize: 13, lineHeight: 1.4,
                  color: done ? "#475569" : active ? "#0f172a" : "#94a3b8",
                  fontWeight: active ? 600 : 400,
                }}>
                  {step}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
