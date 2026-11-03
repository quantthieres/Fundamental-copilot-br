// /macro — Mapa Macro Global.
//
// Server shell: header, page title and source metadata are rendered on the
// server from the static macro caches. Only the interactive workspace
// (MacroExplorer) is a client component; it reads URL state, so it renders
// inside a Suspense boundary with a skeleton fallback.

import React, { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import AppHeader from "@/components/layout/AppHeader";
import MacroExplorer from "@/components/macro/MacroExplorer";
import { getMacroPageMeta } from "@/lib/macro/macro-cache";
import { formatSourceAttributionPt, resolveMacroReferenceYear } from "@/lib/macro/macro-ui";
import styles from "@/components/macro/macro.module.css";

export const metadata: Metadata = {
  title: "Mapa Macro Global · Fundamental Copilot BR",
  description: "Indicadores macroeconômicos globais com dados do FMI (World Economic Outlook) e do BIS.",
};

function ExplorerFallback() {
  return (
    <div className={styles.workspace} aria-busy="true">
      <div className={styles.mapCard}>
        <div className={styles.mapWrap}>
          <div className={styles.overlay}>
            <div className={styles.skeleton} />
            <div className={styles.overlayText}>Carregando mapa…</div>
          </div>
        </div>
      </div>
      <div className={styles.rank}><div className={styles.rankEmpty}>Carregando ranking…</div></div>
    </div>
  );
}

export default function MacroPage() {
  const metas = getMacroPageMeta();
  // Deterministic, data-derived reference year (WEO edition year), computed on
  // the server and passed as a prop, so the client never reads its own clock
  // for defaults. The server clock is only a fallback if no cache is readable.
  const referenceYear = resolveMacroReferenceYear(metas, new Date().getUTCFullYear());
  const sources = [...new Map(metas.filter(m => m.available).map(m => [m.source.id, m.source])).values()];

  return (
    <>
      <AppHeader />
      <main className={styles.page}>
        <div className={styles.head}>
          <div>
            <h1 className={styles.title}>Mapa Macro Global</h1>
            <p className={styles.subtitle}>Indicadores macroeconômicos globais com dados do FMI e BIS.</p>
          </div>
          <div className={styles.sources}>
            <div>Fontes: {sources.map(formatSourceAttributionPt).join(" · ")}</div>
            <div>
              Observado, estimativa e sem dados seguem a classificação da fonte ·{" "}
              <Link href="/metodologia">Metodologia</Link>
            </div>
          </div>
        </div>
        <Suspense fallback={<ExplorerFallback />}>
          <MacroExplorer metas={metas} referenceYear={referenceYear} />
        </Suspense>
      </main>
    </>
  );
}
