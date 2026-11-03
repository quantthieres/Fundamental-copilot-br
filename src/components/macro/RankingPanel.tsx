"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { MACRO_REGIONS } from "@/lib/macro/country-metadata";
import {
  buildRanking,
  formatMacroValue,
  formatReferencePeriod,
  policyRateSourceLabel,
  MACRO_STATUS_LABELS,
  regionLabel,
  type RankingOrder,
} from "@/lib/macro/macro-ui";
import type { MacroCountryValue, MacroIndicatorId, MacroRegionId } from "@/lib/macro/macro-types";
import { StatusBadge } from "./MacroControls";
import styles from "./macro.module.css";

const TOP_N = 20;

export default function RankingPanel({
  indicator,
  label,
  year,
  countries,
  monthly,
  selected,
  onSelect,
}: {
  indicator: MacroIndicatorId;
  label: string;
  year: number;
  countries: readonly MacroCountryValue[] | null;
  monthly: boolean;
  selected: string | null;
  onSelect: (iso3: string) => void;
}) {
  const [order, setOrder] = useState<RankingOrder>("desc");
  const [region, setRegion] = useState<MacroRegionId | "all">("all");
  const [showAll, setShowAll] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);

  const all = useMemo(
    () => (countries ? buildRanking(countries, { order, region }) : []),
    [countries, order, region],
  );
  const rows = showAll ? all : all.slice(0, TOP_N);

  // Keep the selected row visible inside the list.
  useEffect(() => {
    if (!selected || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-iso3="${selected}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selected, rows.length]);

  // When every row shares one status (e.g. all WEO estimates for 2026), say it
  // once in the header instead of repeating a badge on each row.
  const statuses = new Set(all.map(r => r.status));
  const uniformStatus = all.length > 0 && statuses.size === 1 ? all[0].status : null;

  const selectedRow = selected ? all.find(r => r.iso3 === selected) ?? null : null;
  const selectedRank = selectedRow?.rank ?? null;

  return (
    <aside className={styles.rank} aria-labelledby="macro-rank-title">
      <div className={styles.rankHead}>
        <h2 className={styles.rankTitle} id="macro-rank-title">
          Ranking <span>· {label} · {year}</span>
        </h2>
        <div className={styles.rankMeta}>
          {countries ? `${all.length} economias com dados` : "Carregando…"}
          {uniformStatus && !monthly ? ` · todas: ${MACRO_STATUS_LABELS[uniformStatus].toLowerCase()}` : ""}
          {selected && selectedRank === null && countries ? " · seleção fora do filtro ou sem dados" : ""}
          {selectedRow && !rows.includes(selectedRow) && (
            <>
              {" · "}
              <button type="button" className={styles.linkBtn} onClick={() => setShowAll(true)}>
                {selectedRow.countryName}: {selectedRow.rank}º de {all.length}
              </button>
            </>
          )}
        </div>
        <div className={styles.rankCtl}>
          <select
            className={styles.rankSelect}
            value={region}
            onChange={e => setRegion(e.target.value as MacroRegionId | "all")}
            aria-label="Filtrar por região"
          >
            <option value="all">Todas as regiões</option>
            {MACRO_REGIONS.map(r => <option key={r.id} value={r.id}>{r.labelPt}</option>)}
          </select>
          <div className={styles.seg} role="group" aria-label="Ordenação">
            {(["desc", "asc"] as const).map(o => (
              <button
                key={o}
                type="button"
                className={`${styles.segBtn} ${order === o ? styles.segBtnOn : ""}`}
                aria-pressed={order === o}
                onClick={() => setOrder(o)}
              >
                {o === "desc" ? "Maior" : "Menor"}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className={styles.rankCols} aria-hidden="true">
        <span>País</span>
        <span>Valor{monthly ? " · Ref." : ""}</span>
      </div>
      {countries && rows.length === 0 ? (
        <div className={styles.rankEmpty}>Nenhuma economia com dados para este filtro.</div>
      ) : (
        <ul className={styles.rankList} ref={listRef}>
          {rows.map(r => {
            const isSel = r.iso3 === selected;
            return (
              <li key={r.iso3}>
                <button
                  type="button"
                  data-iso3={r.iso3}
                  className={`${styles.row} ${isSel ? styles.rowSel : ""}`}
                  aria-current={isSel ? "true" : undefined}
                  onClick={() => onSelect(r.iso3)}
                >
                  <span className={styles.rowN}>{r.rank}</span>
                  <span className={styles.rowName}>
                    <span>{r.countryName}</span>
                    <small>{regionLabel(r.region)}</small>
                  </span>
                  <span className={styles.rowVal}>
                    <b>{formatMacroValue(indicator, r.value)}</b>
                    {monthly
                      ? <small>{formatReferencePeriod(r.referencePeriod)}{policyRateSourceLabel(r) ? " · BCE" : ""}</small>
                      : !uniformStatus && r.status !== "observed" && <StatusBadge status={r.status} />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {all.length > TOP_N && (
        <div className={styles.rankFoot}>
          <button type="button" className={styles.segBtn} aria-pressed={showAll} onClick={() => setShowAll(v => !v)}>
            {showAll ? `Mostrar top ${TOP_N}` : `Mostrar todas (${all.length})`}
          </button>
        </div>
      )}
    </aside>
  );
}
