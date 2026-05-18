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
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 32,
          flexWrap: "wrap",
        }}>
          {/* Brand + disclaimer */}
          <div>
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

          {/* Contact block */}
          <div style={{
            borderLeft: "1px solid #1e293b",
            paddingLeft: 24,
            minWidth: 200,
          }}>
            <p style={{ margin: "0 0 4px", color: "#94a3b8", fontWeight: 700, fontSize: 10, letterSpacing: "0.7px", textTransform: "uppercase" }}>
              Contato
            </p>
            <p style={{ margin: "0 0 10px", color: "#475569", lineHeight: 1.55 }}>
              Encontrou um problema ou quer sugerir algo?
            </p>
            <a
              href="https://github.com/quantthieres"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                color: "#cbd5e1", textDecoration: "none", fontWeight: 600,
                fontSize: 12, transition: "color 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.color = "#f8fafc")}
              onMouseLeave={e => (e.currentTarget.style.color = "#cbd5e1")}
            >
              <svg
                viewBox="0 0 24 24"
                width={14}
                height={14}
                fill="currentColor"
                aria-hidden="true"
                style={{ flexShrink: 0 }}
              >
                <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
              </svg>
              github.com/quantthieres
            </a>
          </div>
        </div>
      </footer>

    </div>
  );
}
