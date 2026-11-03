"use client";

// Interactive part of /macro: indicator tabs, map, legend, year control,
// ranking, search and the selected-country panel. Data comes only from the
// cached API routes (/api/macro/[indicator], /api/macro/country/[iso3]).

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MACRO_COUNTRIES, getMacroCountry } from "@/lib/macro/country-metadata";
import { colorForValue } from "@/lib/macro/macro-scales";
import {
  buildMacroQueryString,
  resolveInitialMacroState,
  formatMacroValue,
  formatSourceAttributionPt,
  formatVintagePt,
  macroUnitSuffix,
  parseMacroUrlState,
  presentMacroValue,
  regionLabel,
  resolveYearForIndicator,
  sourceShortLabelPt,
  MACRO_STATUS_LABELS,
} from "@/lib/macro/macro-ui";
import type {
  MacroCountrySnapshot,
  MacroCountryValue,
  MacroIndicatorId,
  MacroIndicatorView,
  MacroObservationStatus,
} from "@/lib/macro/macro-types";
import type { MacroIndicatorPageMeta } from "@/lib/macro/macro-cache";
import WorldMap from "./WorldMap";
import RankingPanel from "./RankingPanel";
import CountrySearch from "./CountrySearch";
import CountryDetailPanel, { type SnapshotState } from "./CountryDetailPanel";
import { MacroLegend, StatusBadge, YearControl } from "./MacroControls";
import styles from "./macro.module.css";

type ViewState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; view: MacroIndicatorView };

const SEARCHABLE = MACRO_COUNTRIES.map(c => ({
  iso3: c.iso3,
  countryName: c.namePt,
  regionLabel: regionLabel(c.region),
}));

async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

export default function MacroExplorer({
  metas,
  referenceYear,
}: {
  metas: MacroIndicatorPageMeta[];
  /** Server-computed reference year (see resolveMacroReferenceYear); never the browser clock. */
  referenceYear: number;
}) {
  const searchParams = useSearchParams();
  const metaById = useMemo(() => new Map(metas.map(m => [m.id, m])), [metas]);

  // ── Initial state from the URL (invalid values fall back) ────────────────
  const initial = useMemo(() => resolveInitialMacroState(
    parseMacroUrlState(searchParams),
    Object.fromEntries(metas.map(m => [m.id, m.availableYears])) as Record<MacroIndicatorId, number[]>,
    referenceYear,
  ), []); // mount only: afterwards state drives the URL, not the reverse

  const [indicator, setIndicator] = useState<MacroIndicatorId>(initial.indicator);
  const [year, setYear] = useState<number | null>(initial.year);
  const [selected, setSelected] = useState<string | null>(initial.country);
  // A country from the URL is selected (outlined) but the map keeps the world view.
  const [focus, setFocus] = useState<{ iso3: string; nonce: number } | null>(null);
  const meta = metaById.get(indicator)!;

  // ── Indicator view (cached per indicator|year) ────────────────────────────
  const viewCache = useRef(new Map<string, MacroIndicatorView>());
  const [viewState, setViewState] = useState<ViewState>({ kind: "loading" });
  const [lastReady, setLastReady] = useState<MacroIndicatorView | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (year === null) { setViewState({ kind: "error" }); return; }
    const key = `${indicator}|${year}`;
    const cached = viewCache.current.get(key);
    if (cached) { setViewState({ kind: "ready", view: cached }); setLastReady(cached); return; }
    const ctrl = new AbortController();
    setViewState({ kind: "loading" });
    fetchJson<MacroIndicatorView>(`/api/macro/${indicator}?year=${year}`, ctrl.signal)
      .then(view => {
        viewCache.current.set(key, view);
        setViewState({ kind: "ready", view });
        setLastReady(view);
      })
      .catch(err => { if (!ctrl.signal.aborted) { console.warn("[macro] indicator fetch failed", err); setViewState({ kind: "error" }); } });
    return () => ctrl.abort();
  }, [indicator, year, retry]);

  // While a new year/indicator loads, keep showing the previous view under a soft overlay.
  const shown = viewState.kind === "ready" ? viewState.view : lastReady;
  const shownMatches = shown?.indicator === indicator && shown?.selectedYear === year;

  const values = useMemo(() => new Map((shown?.countries ?? []).map(c => [c.iso3, c])), [shown]);

  const fills = useMemo(() => {
    const m = new Map<string, string>();
    if (!shown) return m;
    for (const c of shown.countries) {
      if (c.status !== "no_data" && c.value !== null) m.set(c.iso3, colorForValue(shown.indicator, c.value));
    }
    return m;
  }, [shown]);

  const labels = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of MACRO_COUNTRIES) {
      const v = values.get(c.iso3);
      m.set(c.iso3, v && v.status !== "no_data" && shown
        ? `${c.namePt}: ${formatMacroValue(shown.indicator, v.value)} (${MACRO_STATUS_LABELS[v.status]})`
        : `${c.namePt}: sem dados`);
    }
    return m;
  }, [values, shown]);

  const counts = useMemo(() => {
    if (!shown || !shownMatches) return null;
    const c: Partial<Record<MacroObservationStatus, number>> = {};
    for (const v of shown.countries) c[v.status] = (c[v.status] ?? 0) + 1;
    return c;
  }, [shown, shownMatches]);

  const hasAnyValue = !!shown && shown.countries.some(c => c.status !== "no_data");

  // ── Selected-country snapshot (one request, cached per iso3|year) ────────
  const snapCache = useRef(new Map<string, MacroCountrySnapshot>());
  const [snapState, setSnapState] = useState<SnapshotState>({ kind: "loading" });
  const [snapRetry, setSnapRetry] = useState(0);

  useEffect(() => {
    if (!selected || year === null) return;
    const key = `${selected}|${year}`;
    const cached = snapCache.current.get(key);
    if (cached) { setSnapState({ kind: "ready", snapshot: cached }); return; }
    const ctrl = new AbortController();
    setSnapState({ kind: "loading" });
    fetchJson<MacroCountrySnapshot>(`/api/macro/country/${selected}?year=${year}`, ctrl.signal)
      .then(s => { snapCache.current.set(key, s); setSnapState({ kind: "ready", snapshot: s }); })
      .catch(err => { if (!ctrl.signal.aborted) { console.warn("[macro] snapshot fetch failed", err); setSnapState({ kind: "error" }); } });
    return () => ctrl.abort();
  }, [selected, year, snapRetry]);

  // ── URL state ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const qs = buildMacroQueryString({ indicator, year, country: selected });
    const url = `${window.location.pathname}?${qs}`;
    if (url !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState(window.history.state, "", url);
    }
  }, [indicator, year, selected]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const pickIndicator = useCallback((id: MacroIndicatorId) => {
    setIndicator(id);
    setYear(y => resolveYearForIndicator(y, metaById.get(id)!.availableYears, referenceYear));
  }, [metaById, referenceYear]);

  const selectCountry = useCallback((iso3: string) => setSelected(iso3), []);
  const selectAndFocus = useCallback((iso3: string) => {
    setSelected(iso3);
    setFocus(f => ({ iso3, nonce: (f?.nonce ?? 0) + 1 }));
  }, []);

  // ── Tooltip ───────────────────────────────────────────────────────────────
  const renderTooltip = useCallback((iso3: string) => {
    const country = getMacroCountry(iso3);
    const v: MacroCountryValue | undefined = values.get(iso3);
    if (!country || !shown) return null;
    if (!v || v.status === "no_data" || v.value === null) {
      return (
        <>
          <div className={styles.tipName}>{country.namePt}</div>
          <div className={styles.tipLabel}>{shown.label} · {shown.selectedYear}</div>
          <div className={styles.tipNoData}>Sem dados para o período</div>
        </>
      );
    }
    const p = presentMacroValue({ ...v, indicator: shown.indicator, frequency: shown.frequency }, shown.latestReferencePeriod);
    return (
      <>
        <div className={styles.tipName}>{country.namePt}</div>
        <div className={styles.tipLabel}>{shown.label}</div>
        <div className={styles.tipValue}>
          {p.valueText}<span className={styles.unitSuffix}>{macroUnitSuffix(shown.indicator)}</span>
        </div>
        {p.sourceAreaLabel && <div className={styles.tipNote}>{p.sourceAreaLabel}</div>}
        {p.freshness?.note && <div className={`${styles.tipNote} ${styles[`fresh_${p.freshness.level}`]}`}>{p.freshness.note}</div>}
        <dl className={styles.tipGrid}>
          <dt>Referência</dt><dd>{p.referenceText}</dd>
          <dt>Status</dt><dd><StatusBadge status={v.status} /></dd>
          <dt>Fonte</dt>
          <dd>{sourceShortLabelPt(meta.source.id)}{meta.source.id === "imf_weo" ? ` · ${formatVintagePt(shown.sourceVintage)}` : ""}</dd>
        </dl>
      </>
    );
  }, [values, shown, meta.source.id]);

  // ── Overlay ───────────────────────────────────────────────────────────────
  let overlay: React.ReactNode = null;
  if (!meta.available) {
    overlay = (
      <div className={styles.overlay} role="alert">
        <div className={styles.errorBox}><b>Indicador indisponível.</b><span>O cache deste indicador não foi encontrado.</span></div>
      </div>
    );
  } else if (viewState.kind === "error") {
    overlay = (
      <div className={styles.overlay} role="alert">
        <div className={styles.errorBox}>
          <b>Não foi possível carregar os dados.</b>
          <span>Verifique a conexão e tente novamente.</span>
          <button type="button" className={styles.btnSm} onClick={() => setRetry(r => r + 1)}>Tentar novamente</button>
        </div>
      </div>
    );
  } else if (viewState.kind === "loading") {
    overlay = shown ? (
      <div className={`${styles.overlay} ${styles.overlaySoft}`} aria-live="polite">
        <div className={styles.overlayText}>Carregando {meta.label.toLowerCase()} · {year}…</div>
      </div>
    ) : (
      <div className={styles.overlay} aria-live="polite">
        <div className={styles.skeleton} />
        <div className={styles.overlayText}>Carregando observações…</div>
      </div>
    );
  } else if (!hasAnyValue) {
    overlay = (
      <div className={`${styles.overlay} ${styles.overlaySoft}`} role="status">
        <div className={styles.errorBox}><b>Sem dados para {meta.label} em {year}.</b><span>Escolha outro ano.</span></div>
      </div>
    );
  }

  const selectedCountry = selected ? getMacroCountry(selected) : null;
  const sourceText = formatSourceAttributionPt(meta.source);

  return (
    <>
      <div className={styles.toolbar}>
        <div className={styles.tabs} role="group" aria-label="Indicador">
          {metas.map(m => (
            <button
              key={m.id}
              type="button"
              className={`${styles.tab} ${m.id === indicator ? styles.tabOn : ""}`}
              aria-pressed={m.id === indicator}
              onClick={() => pickIndicator(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className={styles.metricMeta}>
          {meta.conceptPt} · {meta.frequency === "monthly" ? "mensal" : "anual"} · {sourceShortLabelPt(meta.source.id)}
        </div>
        <CountrySearch countries={SEARCHABLE} onSelect={selectAndFocus} />
      </div>

      <div className={styles.workspace}>
        <div className={styles.mainCol}>
          <section className={styles.mapCard} aria-label={`Mapa: ${meta.label}${year ? `, ${year}` : ""}`}>
            <WorldMap
              fills={fills}
              labels={labels}
              selected={selected}
              onSelect={selectCountry}
              focus={focus}
              renderTooltip={renderTooltip}
              ariaLabel={`Mapa-múndi de ${meta.label}${year ? ` em ${year}` : ""}. Use o ranking ou a busca para selecionar países pelo teclado.`}
              overlay={overlay}
            />
            <div className={styles.mapFoot}>
              <MacroLegend indicator={indicator} label={meta.label} unit={meta.unit} counts={counts} />
              {year !== null && meta.availableYears.length > 0 && (
                <YearControl
                  years={meta.availableYears}
                  year={year}
                  onChange={setYear}
                  hint={meta.frequency === "monthly"
                    ? "Último mês disponível no ano"
                    : year > referenceYear ? "Ano futuro na edição do WEO" : null}
                />
              )}
            </div>
            <div className={styles.sourcesLine}>
              <span>Fonte: {sourceText}{meta.frequency === "monthly" && meta.latestReferencePeriod ? ` · dados até ${formatVintagePt(meta.latestReferencePeriod).toLowerCase()}` : ""}</span>
              <span>Geometria: Natural Earth (world-atlas)</span>
            </div>
          </section>

          {selectedCountry && year !== null && (
            <CountryDetailPanel
              countryName={selectedCountry.namePt}
              state={snapState}
              year={year}
              activeIndicator={indicator}
              metas={metas}
              onPickIndicator={pickIndicator}
              onClear={() => setSelected(null)}
              onRetry={() => setSnapRetry(r => r + 1)}
            />
          )}
        </div>

        <RankingPanel
          indicator={indicator}
          label={meta.label}
          year={year ?? 0}
          countries={shownMatches && shown ? shown.countries : null}
          monthly={meta.frequency === "monthly"}
          selected={selected}
          onSelect={selectCountry}
        />
      </div>
    </>
  );
}
