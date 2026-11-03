// Horizontal "keep in view" for tab strips that scroll inside their own
// container on narrow screens. Unlike Element.scrollIntoView it never scrolls
// the page vertically.

/**
 * New scrollLeft for a strip so that the item [itemLeft, itemLeft+itemWidth)
 * (offsets relative to the strip's content) is fully visible, with `margin`
 * px of breathing room. Returns the current scrollLeft when already visible.
 */
export function scrollLeftToReveal(
  scrollLeft: number,
  viewportWidth: number,
  itemLeft: number,
  itemWidth: number,
  margin = 12,
): number {
  if (itemLeft - margin < scrollLeft) return Math.max(0, itemLeft - margin);
  const itemRight = itemLeft + itemWidth + margin;
  if (itemRight > scrollLeft + viewportWidth) return Math.max(0, itemRight - viewportWidth);
  return scrollLeft;
}

/** Applies scrollLeftToReveal to a DOM strip and one of its items. */
export function revealInStrip(strip: HTMLElement | null, item: HTMLElement | null): void {
  if (!strip || !item || strip.scrollWidth <= strip.clientWidth) return;
  const stripRect = strip.getBoundingClientRect();
  const itemRect = item.getBoundingClientRect();
  const itemLeft = itemRect.left - stripRect.left + strip.scrollLeft;
  const next = scrollLeftToReveal(strip.scrollLeft, strip.clientWidth, itemLeft, itemRect.width);
  if (next !== strip.scrollLeft) strip.scrollLeft = next;
}
