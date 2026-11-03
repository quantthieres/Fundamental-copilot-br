"use client";

// Small presentational pieces of the Macro Map: status badge, legend and the
// year control. Status labels come from macro-ui (never re-derived here).

import React from "react";
import { legendBins } from "@/lib/macro/macro-scales";
import { MACRO_STATUS_LABELS, adjacentYear } from "@/lib/macro/macro-ui";
import type { MacroIndicatorId, MacroObservationStatus } from "@/lib/macro/macro-types";
import styles from "./macro.module.css";

export function StatusBadge({ status }: { status: MacroObservationStatus }) {
  return <span className={`${styles.badge} ${styles[`badge_${status}`]}`}>{MACRO_STATUS_LABELS[status]}</span>;
}

export function MacroLegend({
  indicator,
  label,
  unit,
  counts,
}: {
  indicator: MacroIndicatorId;
  label: string;
  unit: string;
  counts: Partial<Record<MacroObservationStatus, number>> | null;
}) {
  const bins = legendBins(indicator);
  const diverging = bins.some(b => b.startsAtZero);
  return (
    <div>
      <div className={styles.legendTitle}>
        {label} <span>{unit} · {diverging ? "escala divergente, centro em 0%" : "faixas fixas"}</span>
      </div>
      <div className={styles.legendRow}>
        <div className={styles.legendBins} role="list" aria-label="Faixas de cor">
          {bins.map(b => (
            <div key={b.label} role="listitem" className={`${styles.legendBin} ${b.startsAtZero ? styles.legendZero : ""}`}>
              <i style={{ background: b.color }} aria-hidden="true" />
              <span>{b.label}</span>
            </div>
          ))}
        </div>
        <div className={styles.legendExtra}>
          <div className={styles.legendBin}>
            <i className={styles.noDataSwatch} aria-hidden="true" />
            <span>Sem dados</span>
          </div>
        </div>
      </div>
      {counts && (
        <div className={styles.legendCounts}>
          {(["observed", "estimated", "projected"] as const)
            .filter(s => (counts[s] ?? 0) > 0)
            .map(s => `${MACRO_STATUS_LABELS[s]}: ${counts[s]}`)
            .join(" · ")}
          {(counts.no_data ?? 0) > 0 ? ` · ${MACRO_STATUS_LABELS.no_data}: ${counts.no_data}` : ""}
        </div>
      )}
    </div>
  );
}

export function YearControl({
  years,
  year,
  onChange,
  hint,
}: {
  years: readonly number[];
  year: number;
  onChange: (year: number) => void;
  hint?: string | null;
}) {
  const prev = adjacentYear(years, year, -1);
  const next = adjacentYear(years, year, 1);
  const options = [...years].sort((a, b) => b - a);
  return (
    <div>
      <div className={styles.yearCtl}>
        <span className={styles.yearLabel} id="macro-year-label">Ano</span>
        <button
          type="button"
          className={styles.yearBtn}
          onClick={() => prev !== null && onChange(prev)}
          disabled={prev === null}
          aria-label={prev !== null ? `Ano anterior (${prev})` : "Ano anterior"}
        >
          ‹
        </button>
        <select
          className={styles.yearSelect}
          value={year}
          aria-labelledby="macro-year-label"
          onChange={e => onChange(Number(e.target.value))}
        >
          {options.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <button
          type="button"
          className={styles.yearBtn}
          onClick={() => next !== null && onChange(next)}
          disabled={next === null}
          aria-label={next !== null ? `Próximo ano (${next})` : "Próximo ano"}
        >
          ›
        </button>
      </div>
      {hint && <div className={styles.yearHint}>{hint}</div>}
    </div>
  );
}
