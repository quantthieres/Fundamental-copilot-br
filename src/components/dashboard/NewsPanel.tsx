import React from "react";
import SectionCard from "./SectionCard";

interface NewsItem {
  source: string;
  date: string;
  title: string;
  category: string;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  "Resultado":      { bg: "#eff6ff", text: "#1d4ed8" },
  "Fato Relevante": { bg: "#fef3c7", text: "#92400e" },
  "Comunicado":     { bg: "#f0fdf4", text: "#166534" },
  "Proventos":      { bg: "#fdf4ff", text: "#7e22ce" },
  "Macro":          { bg: "#f5f3ff", text: "#6d28d9" },
  "Regulação":      { bg: "#fff7ed", text: "#c2410c" },
};

export default function NewsPanel({ news }: { news: NewsItem[] }) {
  return (
    <SectionCard title="Documentos e Eventos" subtitle="Fatos relevantes, comunicados e resultados">
      {/* Illustrative data notice */}
      <div style={{
        background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6,
        padding: "8px 12px", marginBottom: 12,
        fontSize: 11, color: "#92400e", lineHeight: 1.5,
      }}>
        <strong>Dados ilustrativos</strong> — os itens abaixo são exemplos de formato e não representam
        eventos reais. A integração com fontes oficiais (CVM, B3) será adicionada em versões futuras.
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {news.map((item, i) => {
          const colors = CATEGORY_COLORS[item.category] ?? { bg: "#f1f5f9", text: "#374151" };
          return (
            <div key={i} style={{ padding: "10px 0", borderBottom: i < news.length - 1 ? "1px solid #f1f5f9" : "none", opacity: 0.75 }}>
              <div style={styles.topRow}>
                <span style={styles.illustrativeChip}>Ilustrativo</span>
                <span style={styles.source}>{item.source}</span>
                <span style={styles.dot}>·</span>
                <span style={styles.date}>{item.date}</span>
                <span style={{ ...styles.badge, background: colors.bg, color: colors.text }}>
                  {item.category}
                </span>
              </div>
              <div style={styles.title}>{item.title}</div>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

const styles: Record<string, React.CSSProperties> = {
  topRow: { display: "flex", alignItems: "center", gap: 6, marginBottom: 5 },
  illustrativeChip: {
    fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 3,
    background: "#f1f5f9", color: "#94a3b8", letterSpacing: "0.3px",
    textTransform: "uppercase" as const,
  },
  source: { fontSize: 11, fontWeight: 600, color: "#374151" },
  dot: { color: "#cbd5e1", fontSize: 10 },
  date: { fontSize: 11, color: "#94a3b8" },
  badge: { fontSize: 10, fontWeight: 600, padding: "1px 7px", borderRadius: 20, marginLeft: "auto" },
  title: { fontSize: 13, color: "#0f172a", lineHeight: 1.45, fontWeight: 500, marginBottom: 4 },
};
