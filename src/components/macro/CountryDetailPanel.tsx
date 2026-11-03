"use client";

import React from "react";
import {
  formatSourceAttributionPt,
  macroUnitSuffix,
  presentMacroValue,
  regionLabel,
} from "@/lib/macro/macro-ui";
import type { MacroCountrySnapshot, MacroIndicatorId } from "@/lib/macro/macro-types";
import type { MacroIndicatorPageMeta } from "@/lib/macro/macro-cache";
import { StatusBadge } from "./MacroControls";
import styles from "./macro.module.css";

export type SnapshotState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; snapshot: MacroCountrySnapshot };

export default function CountryDetailPanel({
  countryName,
  state,
  year,
  activeIndicator,
  metas,
  onPickIndicator,
  onClear,
  onRetry,
}: {
  countryName: string;
  state: SnapshotState;
  year: number;
  activeIndicator: MacroIndicatorId;
  metas: readonly MacroIndicatorPageMeta[];
  onPickIndicator: (id: MacroIndicatorId) => void;
  onClear: () => void;
  onRetry: () => void;
}) {
  const metaById = new Map(metas.map(m => [m.id, m]));
  const sources = [...new Map(metas.filter(m => m.available).map(m => [m.source.id, m.source])).values()];

  return (
    <section className={styles.detail} aria-labelledby="macro-detail-title" aria-live="polite">
      <div className={styles.detailHead}>
        <div>
          <h2 className={styles.detailName} id="macro-detail-title">{countryName}</h2>
          <div className={styles.detailRegion}>
            {state.kind === "ready" ? `${regionLabel(state.snapshot.region)} · ` : ""}{year}
          </div>
        </div>
        <button type="button" className={styles.detailClose} onClick={onClear} aria-label={`Limpar seleção de ${countryName}`}>
          Limpar seleção
        </button>
      </div>

      {state.kind === "loading" && <p className={styles.detailHint}>Carregando indicadores…</p>}
      {state.kind === "error" && (
        <div className={styles.detailHint} role="alert">
          Não foi possível carregar os indicadores deste país.{" "}
          <button type="button" className={styles.btnSm} onClick={onRetry}>Tentar novamente</button>
        </div>
      )}
      {state.kind === "ready" && (
        <div className={styles.detailGrid}>
          {state.snapshot.indicators.map(entry => {
            const meta = metaById.get(entry.indicator);
            const p = presentMacroValue(entry, meta?.latestReferencePeriod ?? "");
            const on = entry.indicator === activeIndicator;
            return (
              <button
                key={entry.indicator}
                type="button"
                className={`${styles.detailItem} ${on ? styles.detailItemOn : ""}`}
                aria-pressed={on}
                onClick={() => onPickIndicator(entry.indicator)}
              >
                <span className={styles.detailLabel}>{entry.label}</span>
                <span className={styles.detailValue}>
                  {p.valueText}
                  {entry.value !== null && <span className={styles.unitSuffix}>{macroUnitSuffix(entry.indicator)}</span>}
                </span>
                <span className={styles.detailMeta}>
                  <StatusBadge status={entry.value === null ? "no_data" : entry.status} />
                  {p.referenceText && entry.frequency === "monthly" && <span>{p.referenceText}</span>}
                </span>
                {p.sourceAreaLabel && <span className={styles.detailMeta}>{p.sourceAreaLabel}</span>}
                {p.freshness?.note && (
                  <span className={`${styles.detailMeta} ${styles[`fresh_${p.freshness.level}`]}`}>{p.freshness.note}</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className={styles.detailSrc}>
        Fontes: {sources.map(formatSourceAttributionPt).join(" · ")}
      </div>
    </section>
  );
}
