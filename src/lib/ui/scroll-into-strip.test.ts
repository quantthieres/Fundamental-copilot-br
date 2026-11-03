import { describe, it, expect } from "vitest";
import { scrollLeftToReveal } from "./scroll-into-strip";

describe("scrollLeftToReveal", () => {
  it("keeps the position when the item is already fully visible", () => {
    expect(scrollLeftToReveal(0, 350, 100, 80)).toBe(0);
    expect(scrollLeftToReveal(120, 350, 200, 80)).toBe(120);
  });

  it("scrolls right just enough to reveal an item past the right edge (with margin)", () => {
    // item 400–510, viewport 350 → right edge 522 → scrollLeft 172
    expect(scrollLeftToReveal(0, 350, 400, 110)).toBe(172);
  });

  it("scrolls left to reveal an item hidden on the left, never below 0", () => {
    expect(scrollLeftToReveal(300, 350, 100, 80)).toBe(88);
    expect(scrollLeftToReveal(300, 350, 4, 80)).toBe(0);
  });

  it("supports a custom margin", () => {
    expect(scrollLeftToReveal(0, 300, 290, 50, 0)).toBe(40);
  });
});
