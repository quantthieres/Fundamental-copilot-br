// Viewport math for the Macro Map SVG (pure; unit-tested).
//
// Geometry is projected once into a fixed 960×500 viewBox. The SVG uses
// preserveAspectRatio "xMidYMid slice": on containers taller than 960:500
// (phones, where the map has a minimum height) a centred horizontal window of
// the world is shown and can be dragged sideways instead of letterboxing a
// tiny map. On wider containers the whole world is visible.

export const MAP_VIEWBOX_WIDTH = 960;
export const MAP_VIEWBOX_HEIGHT = 500;
export const MAP_MIN_ZOOM = 1;
export const MAP_MAX_ZOOM = 8;

const W = MAP_VIEWBOX_WIDTH;
const H = MAP_VIEWBOX_HEIGHT;

export interface MapTransform { k: number; x: number; y: number }

/** Size (in viewBox units) of the part of the viewBox that is visible. */
export interface VisibleBox { vw: number; vh: number }

export const FULL_VISIBLE_BOX: VisibleBox = { vw: W, vh: H };

export function visibleBoxFor(containerWidth: number, containerHeight: number): VisibleBox {
  if (containerWidth <= 0 || containerHeight <= 0) return FULL_VISIBLE_BOX;
  const s = Math.max(containerWidth / W, containerHeight / H);
  return { vw: containerWidth / s, vh: containerHeight / s };
}

/** Clamps zoom and keeps the scaled map covering the visible window. */
export function clampMapTransform(t: MapTransform, box: VisibleBox = FULL_VISIBLE_BOX): MapTransform {
  const k = Math.min(MAP_MAX_ZOOM, Math.max(MAP_MIN_ZOOM, t.k));
  const x = Math.min((W - box.vw) / 2, Math.max((W + box.vw) / 2 - W * k, t.x));
  const y = Math.min((H - box.vh) / 2, Math.max((H + box.vh) / 2 - H * k, t.y));
  return { k, x, y };
}
