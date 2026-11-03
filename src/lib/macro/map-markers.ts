// Point markers for economies without a polygon in the 110m world-atlas
// geometry used by the Macro Map (microstates and small island economies).
//
// Coordinates are the spherical centroids (d3-geo geoCentroid) of the
// matching world-atlas@2.0.2 countries-50m features, rounded to 2 decimals.
// map-markers.test.ts recomputes them from the installed package, so the
// table cannot drift from its source.
//
// Tuvalu (TUV) has no feature in either resolution; Kosovo (XKX) has no ISO
// numeric id. Both remain without geometry (ranking/search/panel only).
//
// No @/ imports — pure data, safe for client and server.

/** ISO-3 → [longitude, latitude]. */
export const MAP_POINT_MARKERS: Readonly<Record<string, readonly [number, number]>> = {
  ABW: [-69.98, 12.52],
  AND: [1.56, 42.54],
  ATG: [-61.79, 17.28],
  BHR: [50.54, 26.04],
  BRB: [-59.56, 13.18],
  COM: [43.68, -11.88],
  CPV: [-23.96, 15.96],
  DMA: [-61.36, 15.44],
  FSM: [153.30, 7.54],
  GRD: [-61.68, 12.12],
  HKG: [114.11, 22.40],
  KIR: [-167.92, 0.89],
  KNA: [-62.69, 17.26],
  LCA: [-60.97, 13.89],
  LIE: [9.54, 47.14],
  MAC: [113.51, 22.22],
  MDV: [73.46, 3.73],
  MHL: [170.33, 7.02],
  MLT: [14.41, 35.92],
  MUS: [57.57, -20.28],
  NRU: [166.93, -0.52],
  PLW: [134.41, 7.29],
  SGP: [103.82, 1.36],
  SMR: [12.46, 43.94],
  STP: [6.72, 0.44],
  SYC: [55.48, -4.66],
  TON: [-174.80, -20.42],
  VCT: [-61.20, 13.23],
  WSM: [-172.16, -13.75],
};

/** Countries in the Macro Map table that have neither a polygon nor a marker. */
export const COUNTRIES_WITHOUT_GEOMETRY: readonly string[] = ["TUV", "XKX"];
