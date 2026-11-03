"use client";

// SVG world choropleth for the Macro Map.
//
// Geometry: world-atlas@2.0.2 countries-110m (Natural Earth), loaded once as a
// code-split chunk from the installed package (no network/CDN geometry).
// Projection: d3-geo Natural Earth, fitted to a fixed 960×500 viewBox, so
// paths are computed once per session and the SVG scales responsively.
// Countries join to macro data only through ISO3_TO_ISO_NUMERIC.

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { geometryIdToIso3 } from "@/lib/macro/map-geography";
import { MAP_POINT_MARKERS } from "@/lib/macro/map-markers";
import { MACRO_NO_DATA_COLOR, MACRO_UNCOVERED_COLOR } from "@/lib/macro/macro-scales";
import {
  FULL_VISIBLE_BOX,
  MAP_VIEWBOX_HEIGHT as H,
  MAP_VIEWBOX_WIDTH as W,
  MAP_MAX_ZOOM,
  MAP_MIN_ZOOM,
  clampMapTransform as clampTransform,
  visibleBoxFor,
  type MapTransform as Transform,
  type VisibleBox,
} from "@/lib/macro/map-viewport";
import styles from "./macro.module.css";

const ANTARCTICA_ID = "010";

interface Shape {
  key: string;
  iso3: string | null;
  d: string;
  centroid: [number, number];
}

interface Marker {
  iso3: string;
  x: number;
  y: number;
}

interface MapGeometry {
  shapes: Shape[];
  markers: Marker[];
  centroids: Map<string, [number, number]>;
}

let geometryPromise: Promise<MapGeometry> | null = null;

function buildGeometry(topology: Topology): MapGeometry {
  const collection = feature(
    topology,
    topology.objects.countries as GeometryCollection,
  ) as FeatureCollection<Geometry, { name?: string }>;
  const features = collection.features.filter(f => String(f.id ?? "") !== ANTARCTICA_ID);
  const projection = geoNaturalEarth1().fitExtent(
    [[6, 6], [W - 6, H - 6]],
    { type: "FeatureCollection", features } as FeatureCollection,
  );
  const path = geoPath(projection);
  const centroids = new Map<string, [number, number]>();
  const shapes: Shape[] = features.map((f: Feature<Geometry, { name?: string }>, i) => {
    const iso3 = geometryIdToIso3(f.id === undefined ? null : String(f.id));
    const centroid = path.centroid(f) as [number, number];
    if (iso3) centroids.set(iso3, centroid);
    return { key: `${f.id ?? "x"}-${i}`, iso3, d: path(f) ?? "", centroid };
  });
  const markers: Marker[] = [];
  for (const [iso3, lonLat] of Object.entries(MAP_POINT_MARKERS)) {
    const p = projection([lonLat[0], lonLat[1]]);
    if (!p) continue;
    markers.push({ iso3, x: p[0], y: p[1] });
    centroids.set(iso3, [p[0], p[1]]);
  }
  return { shapes, markers, centroids };
}

function loadGeometry(): Promise<MapGeometry> {
  if (!geometryPromise) {
    geometryPromise = import("world-atlas/countries-110m.json")
      .then(m => buildGeometry((m.default ?? m) as unknown as Topology))
      .catch(err => {
        geometryPromise = null;
        throw err;
      });
  }
  return geometryPromise;
}

export interface WorldMapProps {
  /** iso3 → fill color for countries with a value. */
  fills: ReadonlyMap<string, string>;
  /** iso3 → accessible label ("Brasil: 4,36%"). */
  labels: ReadonlyMap<string, string>;
  selected: string | null;
  onSelect: (iso3: string) => void;
  /** Changing `nonce` re-centers the map on `iso3`. */
  focus: { iso3: string; nonce: number } | null;
  renderTooltip: (iso3: string) => React.ReactNode;
  ariaLabel: string;
  /** Overlay (loading / error) drawn above the map. */
  overlay?: React.ReactNode;
}

export default function WorldMap({
  fills,
  labels,
  selected,
  onSelect,
  focus,
  renderTooltip,
  ariaLabel,
  overlay,
}: WorldMapProps) {
  const [geometry, setGeometry] = useState<MapGeometry | null>(null);
  const [geoError, setGeoError] = useState(false);
  const [transform, setTransform] = useState<Transform>({ k: 1, x: 0, y: 0 });
  const [hover, setHover] = useState<{ iso3: string; px: number; py: number } | null>(null);
  const [tipPos, setTipPos] = useState<{ left: number; top: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; sx: number; sy: number; t: Transform; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const [box, setBox] = useState<VisibleBox>(FULL_VISIBLE_BOX);
  const boxRef = useRef<VisibleBox>(FULL_VISIBLE_BOX);

  // Track the visible part of the viewBox (depends on the container shape).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(entries => {
      const r = entries[0].contentRect;
      const next = visibleBoxFor(r.width, r.height);
      boxRef.current = next;
      setBox(next);
      setTransform(prev => clampTransform(prev, next));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const load = useCallback(() => {
    setGeoError(false);
    loadGeometry().then(setGeometry, () => setGeoError(true));
  }, []);

  useEffect(load, [load]);

  // Re-center on request (search / ranking selection).
  useEffect(() => {
    if (!focus || !geometry) return;
    const c = geometry.centroids.get(focus.iso3);
    if (!c) return;
    setTransform(prev => {
      const k = Math.max(prev.k, 2.5);
      return clampTransform({ k, x: W / 2 - c[0] * k, y: H / 2 - c[1] * k }, boxRef.current);
    });
  }, [focus, geometry]);

  // Keep the tooltip inside the map area.
  useLayoutEffect(() => {
    if (!hover || !wrapRef.current) { setTipPos(null); return; }
    const wrap = wrapRef.current.getBoundingClientRect();
    const tw = tipRef.current?.offsetWidth ?? 232;
    const th = tipRef.current?.offsetHeight ?? 140;
    let left = hover.px + 14;
    let top = hover.py + 14;
    if (left + tw > wrap.width - 6) left = Math.max(6, hover.px - tw - 14);
    if (top + th > wrap.height - 6) top = Math.max(6, hover.py - th - 14);
    setTipPos({ left, top });
  }, [hover]);

  const zoomBy = useCallback((factor: number) => {
    setTransform(prev => {
      const k = Math.min(MAP_MAX_ZOOM, Math.max(MAP_MIN_ZOOM, prev.k * factor));
      // Zoom around the viewBox center.
      const cx = (W / 2 - prev.x) / prev.k;
      const cy = (H / 2 - prev.y) / prev.k;
      return clampTransform({ k, x: W / 2 - cx * k, y: H / 2 - cy * k }, boxRef.current);
    });
  }, []);

  /** viewBox units per CSS pixel (slice scaling). */
  const svgScale = () => {
    const el = svgRef.current;
    if (!el) return 1;
    return 1 / Math.max(el.clientWidth / W, el.clientHeight / H, 1e-6);
  };

  // Pannable when zoomed in, or when the container crops the world (phones).
  const cropped = box.vw < W - 0.5 || box.vh < H - 0.5;
  const pannable = transform.k > 1 || cropped;
  const isWorldView = transform.k === 1 && transform.x === 0 && transform.y === 0;

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (!pannable || e.button !== 0) return;
    drag.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, t: transform, moved: false };
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const d = drag.current;
    if (d && d.id === e.pointerId) {
      const dx = e.clientX - d.sx;
      const dy = e.clientY - d.sy;
      if (!d.moved && Math.hypot(dx, dy) > 4) {
        d.moved = true;
        try {
          svgRef.current?.setPointerCapture(e.pointerId);
        } catch {
          // Pointer already released (or synthetic): panning still works without capture.
        }
      }
      if (d.moved) {
        const s = svgScale();
        setTransform(clampTransform({ k: d.t.k, x: d.t.x + dx * s, y: d.t.y + dy * s }, boxRef.current));
        setHover(null);
      }
    }
  }

  function onPointerUp(e: React.PointerEvent<SVGSVGElement>) {
    const d = drag.current;
    if (d && d.id === e.pointerId) {
      suppressClick.current = d.moved;
      drag.current = null;
    }
  }

  function handleShapeClick(iso3: string | null) {
    if (suppressClick.current) { suppressClick.current = false; return; }
    if (iso3) onSelectRef.current(iso3);
  }

  function handleHover(e: React.PointerEvent, iso3: string | null) {
    if (e.pointerType !== "mouse" || drag.current?.moved || !iso3 || !wrapRef.current) {
      if (!iso3) setHover(null);
      return;
    }
    const r = wrapRef.current.getBoundingClientRect();
    setHover({ iso3, px: e.clientX - r.left, py: e.clientY - r.top });
  }

  const markerRadius = 3.4 / Math.sqrt(transform.k);

  const shapes = useMemo(() => {
    if (!geometry) return null;
    return geometry.shapes.map(s => {
      const covered = s.iso3 !== null;
      const fill = covered ? fills.get(s.iso3!) : undefined;
      return (
        <path
          key={s.key}
          d={s.d}
          className={covered ? styles.country : styles.uncovered}
          fill={covered ? fill ?? "url(#macro-nodata)" : MACRO_UNCOVERED_COLOR}
          stroke="#ffffff"
          strokeWidth={0.6}
          vectorEffect="non-scaling-stroke"
          role={covered ? "listitem" : undefined}
          aria-label={covered ? labels.get(s.iso3!) : undefined}
          aria-hidden={covered ? undefined : true}
          onClick={covered ? () => handleShapeClick(s.iso3) : undefined}
          onPointerMove={covered ? e => handleHover(e, s.iso3) : undefined}
          onPointerLeave={() => setHover(null)}
        />
      );
    });
  }, [geometry, fills, labels]); // handlers only use refs and state setters

  const selectedShapes = geometry && selected
    ? geometry.shapes.filter(s => s.iso3 === selected)
    : [];
  const selectedMarker = geometry && selected
    ? geometry.markers.find(m => m.iso3 === selected)
    : undefined;

  return (
    // touch-action: pan-y while only horizontally cropped (page still scrolls
    // vertically, horizontal drags pan the map); none when zoomed in.
    <div ref={wrapRef} className={`${styles.mapWrap} ${transform.k > 1 ? styles.mapWrapZoomed : ""}`}>
      <svg
        ref={svgRef}
        className={`${styles.mapSvg} ${pannable ? styles.mapSvgPannable : ""}`}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid slice"
        role="group"
        aria-label={ariaLabel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <pattern id="macro-nodata" width="4" height="4" patternUnits="userSpaceOnUse">
            <rect width="4" height="4" fill={MACRO_NO_DATA_COLOR} />
            <circle cx="1" cy="1" r="0.55" fill="#b8c2cf" />
          </pattern>
        </defs>
        <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.k})`}>
          <g role="list" aria-label="Países">{shapes}</g>
          {geometry && (
            <g role="list" aria-label="Economias pequenas (marcadores)">
              {geometry.markers.map(m => (
                <circle
                  key={m.iso3}
                  cx={m.x}
                  cy={m.y}
                  r={markerRadius}
                  className={styles.country}
                  fill={fills.get(m.iso3) ?? "url(#macro-nodata)"}
                  stroke="#475569"
                  strokeWidth={0.7}
                  vectorEffect="non-scaling-stroke"
                  role="listitem"
                  aria-label={labels.get(m.iso3)}
                  onClick={() => handleShapeClick(m.iso3)}
                  onPointerMove={e => handleHover(e, m.iso3)}
                  onPointerLeave={() => setHover(null)}
                />
              ))}
            </g>
          )}
          {/* Selected outline: white halo + dark stroke stays visible on any fill. */}
          <g pointerEvents="none" aria-hidden="true">
            {selectedShapes.map(s => (
              <React.Fragment key={s.key}>
                <path d={s.d} fill="none" stroke="#ffffff" strokeWidth={4} vectorEffect="non-scaling-stroke" />
                <path d={s.d} fill="none" stroke="#0f172a" strokeWidth={2} vectorEffect="non-scaling-stroke" />
              </React.Fragment>
            ))}
            {selectedMarker && (
              <>
                <circle cx={selectedMarker.x} cy={selectedMarker.y} r={markerRadius + 1.6 / Math.sqrt(transform.k)} fill="none" stroke="#ffffff" strokeWidth={4} vectorEffect="non-scaling-stroke" />
                <circle cx={selectedMarker.x} cy={selectedMarker.y} r={markerRadius + 1.6 / Math.sqrt(transform.k)} fill="none" stroke="#0f172a" strokeWidth={2} vectorEffect="non-scaling-stroke" />
              </>
            )}
          </g>
        </g>
      </svg>

      <div className={styles.zoom}>
        <button type="button" onClick={() => zoomBy(1.6)} disabled={transform.k >= MAP_MAX_ZOOM} aria-label="Aproximar">+</button>
        <button type="button" onClick={() => zoomBy(1 / 1.6)} disabled={transform.k <= MAP_MIN_ZOOM} aria-label="Afastar">−</button>
        <button
          type="button"
          onClick={() => setTransform({ k: 1, x: 0, y: 0 })}
          disabled={isWorldView}
          aria-label="Visão mundial"
          title="Visão mundial"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
            <path d="M2 8h12M8 2c2 2 2 10 0 12M8 2c-2 2-2 10 0 12" stroke="currentColor" strokeWidth="1.1" />
          </svg>
        </button>
      </div>

      {hover && (
        <div
          ref={tipRef}
          className={styles.tip}
          role="tooltip"
          style={{
            transform: tipPos ? `translate(${tipPos.left}px, ${tipPos.top}px)` : undefined,
            visibility: tipPos ? "visible" : "hidden",
          }}
        >
          {renderTooltip(hover.iso3)}
        </div>
      )}

      {!geometry && !geoError && (
        <div className={styles.overlay} aria-live="polite">
          <div className={styles.skeleton} />
          <div className={styles.overlayText}>Carregando mapa…</div>
        </div>
      )}
      {geoError && (
        <div className={styles.overlay} role="alert">
          <div className={styles.errorBox}>
            <b>Não foi possível carregar o mapa.</b>
            <span>Os dados continuam disponíveis no ranking e na busca.</span>
            <button type="button" className={styles.btnSm} onClick={load}>Tentar novamente</button>
          </div>
        </div>
      )}
      {geometry && overlay}
    </div>
  );
}
