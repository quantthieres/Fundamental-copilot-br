"use client";

import React, { useState, useEffect } from "react";
import SectionCard from "./SectionCard";
import type { CvmDocumentsResponse, CvmDocument } from "@/lib/cvm/documents-types";

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  "Demonstrações Anuais":      { bg: "#eff6ff", text: "#1d4ed8" },
  "Resultado Trimestral":      { bg: "#eff6ff", text: "#2563eb" },
  "Fato Relevante":            { bg: "#fef3c7", text: "#92400e" },
  "Comunicado":                { bg: "#f0fdf4", text: "#166534" },
  "Formulário de Referência":  { bg: "#fdf4ff", text: "#7e22ce" },
  "Assembleia":                { bg: "#fff7ed", text: "#c2410c" },
  "Informações Anuais":        { bg: "#f0fdf4", text: "#15803d" },
  "Formulário Cadastral":      { bg: "#f8fafc", text: "#475569" },
  "Documento CVM":             { bg: "#f8fafc", text: "#64748b" },
};

function defaultColor() {
  return { bg: "#f1f5f9", text: "#374151" };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "32px 0", gap: 10,
    }}>
      <div style={{
        width: 14, height: 14, borderRadius: "50%",
        border: "2px solid #e2e8f0", borderTopColor: "#2563eb",
        animation: "spin 0.7s linear infinite",
      }} />
      <span style={{ fontSize: 13, color: "#94a3b8" }}>Buscando documentos CVM...</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function ErrorState() {
  return (
    <div style={{
      background: "#fef3c7", border: "1px solid #fde68a",
      borderRadius: 8, padding: "12px 16px",
      fontSize: 12, color: "#92400e", lineHeight: 1.6,
    }}>
      Não foi possível carregar os documentos CVM no momento. Tente novamente mais tarde.
    </div>
  );
}

function EmptyState({ reason }: { reason?: string }) {
  return (
    <div style={{
      background: "#f8fafc", border: "1px solid #e2e8f0",
      borderRadius: 8, padding: "20px 16px", textAlign: "center",
    }}>
      <div style={{ fontSize: 20, marginBottom: 8 }}>📋</div>
      <div style={{ fontSize: 13, color: "#475569", fontWeight: 600, marginBottom: 4 }}>
        Documentos oficiais não disponíveis
      </div>
      <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
        {reason ?? "Documentos oficiais ainda não disponíveis para este ativo no sistema."}
      </div>
    </div>
  );
}

function DocumentRow({ doc, isLast }: { doc: CvmDocument; isLast: boolean }) {
  const colors = CATEGORY_COLORS[doc.category] ?? defaultColor();
  const formattedDate = (() => {
    try {
      const [y, m, d] = doc.date.split("-");
      const months = ["jan.", "fev.", "mar.", "abr.", "mai.", "jun.",
                      "jul.", "ago.", "set.", "out.", "nov.", "dez."];
      return `${d} ${months[parseInt(m, 10) - 1]} ${y}`;
    } catch {
      return doc.date;
    }
  })();

  return (
    <div style={{
      padding: "10px 0",
      borderBottom: isLast ? "none" : "1px solid #f1f5f9",
    }}>
      <div style={styles.topRow}>
        <span style={{
          fontSize: 9, fontWeight: 700, letterSpacing: "0.5px",
          textTransform: "uppercase" as const,
          background: "#dcfce7", color: "#15803d",
          padding: "2px 6px", borderRadius: 3, flexShrink: 0,
        }}>
          CVM
        </span>
        <span style={styles.date}>{formattedDate}</span>
        <span style={{
          ...styles.badge,
          background: colors.bg,
          color: colors.text,
        }}>
          {doc.category}
        </span>
      </div>

      <div style={styles.title}>{doc.title}</div>

      {doc.url && (
        <a
          href={doc.url}
          target="_blank"
          rel="noopener noreferrer"
          style={styles.docLink}
        >
          Abrir documento CVM →
        </a>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type FetchState = "idle" | "loading" | "done" | "error";

interface Props {
  ticker: string;
}

export default function DocumentsPanel({ ticker }: Props) {
  const [state, setState]         = useState<FetchState>("loading");
  const [data, setData]           = useState<CvmDocumentsResponse | null>(null);
  const [noMapping, setNoMapping] = useState(false);

  useEffect(() => {
    if (!ticker) return;
    const controller = new AbortController();
    let active = true;
    setState("loading");
    setData(null);
    setNoMapping(false);

    fetch(`/api/cvm/documents/${encodeURIComponent(ticker)}`, { signal: controller.signal })
      .then(res => res.json())
      .then((body: CvmDocumentsResponse) => {
        if (!active) return;
        if (body.error?.includes("Sem mapeamento")) setNoMapping(true);
        setData(body);
        setState("done");
      })
      .catch(() => {
        if (active) setState("error");
      });

    return () => { active = false; controller.abort(); };
  }, [ticker]);

  const documents = data?.documents ?? [];
  const isEmpty   = state === "done" && documents.length === 0;

  return (
    <SectionCard
      title="Documentos e Eventos"
      subtitle="Documentos oficiais CVM — DFP, ITR, FRE e fatos relevantes"
    >
      {state === "loading" && <LoadingState />}
      {state === "error"   && <ErrorState />}

      {state === "done" && isEmpty && (
        <EmptyState
          reason={
            noMapping
              ? "Este ticker não possui mapeamento CVM verificado. Os documentos serão integrados quando o mapeamento for confirmado."
              : "Nenhum documento CVM encontrado nos últimos 18 meses para este ticker."
          }
        />
      )}

      {state === "done" && documents.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {documents.map((doc, i) => (
            <DocumentRow
              key={doc.id}
              doc={doc}
              isLast={i === documents.length - 1}
            />
          ))}
          <div style={{
            marginTop: 12, paddingTop: 10,
            borderTop: "1px solid #f1f5f9",
            fontSize: 11, color: "#94a3b8", lineHeight: 1.5,
          }}>
            Fonte: CVM Dados Abertos · ENET — documentos ordenados por data de recebimento (decrescente).
            Os links abrem o visualizador oficial da CVM.
          </div>
        </div>
      )}
    </SectionCard>
  );
}

const styles: Record<string, React.CSSProperties> = {
  topRow: {
    display: "flex", alignItems: "center", gap: 6, marginBottom: 5, flexWrap: "wrap",
  },
  date: { fontSize: 11, color: "#94a3b8" },
  badge: {
    fontSize: 10, fontWeight: 600, padding: "1px 7px",
    borderRadius: 20, marginLeft: "auto", whiteSpace: "nowrap",
  },
  title: {
    fontSize: 13, color: "#0f172a", lineHeight: 1.45,
    fontWeight: 500, marginBottom: 4,
  },
  docLink: {
    fontSize: 11, color: "#2563eb", textDecoration: "none",
    fontWeight: 500,
  },
};
