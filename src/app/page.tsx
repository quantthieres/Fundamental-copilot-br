"use client";

import AppHeader from "@/components/layout/AppHeader";
import TickerSearchBox from "@/components/search/TickerSearchBox";
import { useRouter } from "next/navigation";

const QUICK_TICKERS = ["WEGE3", "PETR4", "VALE3", "KLBN11", "LREN3"];

const FEATURES = [
  {
    title: "Dados CVM",
    desc: "Demonstrações financeiras públicas organizadas e padronizadas.",
  },
  {
    title: "Indicadores financeiros",
    desc: "Margens, crescimento, caixa, endividamento e múltiplos de mercado.",
  },
  {
    title: "Diagnóstico objetivo",
    desc: "Sinais financeiros baseados em regras transparentes.",
  },
  {
    title: "Documentos oficiais",
    desc: "Consulta a documentos e eventos públicos quando disponíveis.",
  },
];

export default function LandingPage() {
  const router = useRouter();

  function goTicker(ticker: string) {
    router.push(`/dashboard?ticker=${encodeURIComponent(ticker)}`);
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#f8fafc" }}>

      {/* ── Shared app header — identical to dashboard bar ─────────────────── */}
      <AppHeader />

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <main style={{ flex: 1, display: "flex", alignItems: "center", padding: "64px 0 48px" }}>
        <div style={{ maxWidth: 980, margin: "0 auto", padding: "0 28px", width: "100%", textAlign: "center" }}>

          <h1 style={{
            fontSize: 38, lineHeight: 1.1, letterSpacing: "-1px", fontWeight: 700,
            marginBottom: 16, maxWidth: 720, marginLeft: "auto", marginRight: "auto",
            color: "#0f172a",
          }}>
            Análise fundamentalista da{" "}
            <span style={{ color: "#2563eb" }}>B3</span>{" "}
            com dados CVM.
          </h1>

          <p style={{
            fontSize: 16, color: "#475569", maxWidth: 600,
            margin: "0 auto 32px", lineHeight: 1.6,
          }}>
            Consulte empresas brasileiras, acompanhe indicadores financeiros, métricas
            de mercado e documentos oficiais em uma interface simples.
          </p>

          {/* Autocomplete search box */}
          <TickerSearchBox />

          {/* Quick chips */}
          <div style={{ display: "flex", gap: 8, justifyContent: "center", alignItems: "center", marginTop: 16, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>Tente:</span>
            {QUICK_TICKERS.map(t => (
              <button
                key={t}
                onClick={() => goTicker(t)}
                style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 600,
                  color: "#475569", background: "#fff", border: "1px solid #e2e8f0",
                  padding: "4px 10px", borderRadius: 6, cursor: "pointer",
                }}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Feature cards */}
          <div style={{ marginTop: 56, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
            {FEATURES.map(f => (
              <div
                key={f.title}
                style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 18, textAlign: "left" }}
              >
                <h3 style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 6, letterSpacing: "-0.1px", margin: "0 0 6px" }}>
                  {f.title}
                </h3>
                <p style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5, margin: 0 }}>
                  {f.desc}
                </p>
              </div>
            ))}
          </div>

          {/* Disclaimer */}
          <p style={{
            marginTop: 32, fontSize: 12, color: "#94a3b8",
            maxWidth: 640, marginLeft: "auto", marginRight: "auto", lineHeight: 1.55,
          }}>
            Projeto educacional em desenvolvimento. As informações exibidas não constituem
            recomendação de investimento.
          </p>

        </div>
      </main>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer style={{
        background: "#0f172a", borderTop: "1px solid #1e293b",
        padding: "24px 0", fontSize: 12,
      }}>
        <div style={{
          width: "100%",
          padding: "0 clamp(24px, 3vw, 48px)",
          textAlign: "left",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ color: "#f8fafc", fontWeight: 700, fontSize: 13, letterSpacing: "-0.2px" }}>
              Fundamental Copilot
            </span>
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: "0.9px",
              color: "#64748b", background: "#1e293b", border: "1px solid #334155",
              borderRadius: 4, padding: "2px 6px",
            }}>
              BR
            </span>
          </div>
          <p style={{ margin: 0, color: "#475569", lineHeight: 1.6, maxWidth: 520 }}>
            Projeto educacional em desenvolvimento.{" "}
            As informações exibidas não constituem recomendação de investimento.
          </p>
        </div>
      </footer>

    </div>
  );
}
