import { describe, it, expect } from "vitest";
import { FULL_VISIBLE_BOX, clampMapTransform, visibleBoxFor } from "./map-viewport";

describe("map viewport (slice scaling)", () => {
  it("shows the whole world when the container has the 960:500 ratio or wider", () => {
    expect(visibleBoxFor(960, 500)).toEqual({ vw: 960, vh: 500 });
    const wide = visibleBoxFor(1200, 500); // wider than 960:500 → full width, cropped height
    expect(wide.vw).toBeCloseTo(960);
    expect(visibleBoxFor(0, 0)).toEqual(FULL_VISIBLE_BOX);
  });

  it("crops horizontally on a phone-sized container with a minimum height", () => {
    // ~375 px viewport → ~349 px wide map with a 270 px minimum height.
    const box = visibleBoxFor(349, 270);
    expect(box.vh).toBeCloseTo(500);
    expect(box.vw).toBeCloseTo(646.3, 0);
  });

  it("at zoom 1 with a full box, the transform is pinned to the origin", () => {
    expect(clampMapTransform({ k: 1, x: 50, y: -20 })).toEqual({ k: 1, x: 0, y: 0 });
  });

  it("allows horizontal panning at zoom 1 only within the cropped area", () => {
    const box = visibleBoxFor(349, 270);
    const slack = (960 - box.vw) / 2;
    expect(clampMapTransform({ k: 1, x: 1000, y: 0 }, box).x).toBeCloseTo(slack);
    expect(clampMapTransform({ k: 1, x: -1000, y: 0 }, box).x).toBeCloseTo(-slack);
    expect(clampMapTransform({ k: 1, x: 0, y: 40 }, box).y).toBeCloseTo(0);
  });

  it("clamps zoom to [1, 8] and keeps the zoomed map covering the view", () => {
    expect(clampMapTransform({ k: 20, x: 0, y: 0 }).k).toBe(8);
    expect(clampMapTransform({ k: 0.2, x: 0, y: 0 }).k).toBe(1);
    const t = clampMapTransform({ k: 2, x: -5000, y: -5000 });
    expect(t).toEqual({ k: 2, x: -960, y: -500 });
  });
});
