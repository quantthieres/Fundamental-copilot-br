import { describe, it, expect } from "vitest";
import { mapWithConcurrency } from "./concurrency";

const tick = () => new Promise<void>(r => setTimeout(r, 1));

describe("mapWithConcurrency", () => {
  it("preserves input order", async () => {
    const out = await mapWithConcurrency([30, 10, 20], 2, async (n) => {
      await new Promise(r => setTimeout(r, n));
      return n * 2;
    });
    expect(out).toEqual([60, 20, 40]);
  });

  it.each([1, 2, 3])("never exceeds limit %i", async (limit) => {
    let active = 0;
    let peak = 0;
    await mapWithConcurrency(Array.from({ length: 10 }, (_, i) => i), limit, async () => {
      active++;
      peak = Math.max(peak, active);
      await tick();
      active--;
    });
    expect(peak).toBe(limit);
  });

  it("limit 1 runs strictly sequentially", async () => {
    const log: string[] = [];
    await mapWithConcurrency(["a", "b", "c"], 1, async (x) => {
      log.push(`start ${x}`);
      await tick();
      log.push(`end ${x}`);
    });
    expect(log).toEqual(["start a", "end a", "start b", "end b", "start c", "end c"]);
  });

  it("handles an empty list", async () => {
    expect(await mapWithConcurrency([], 3, async () => 1)).toEqual([]);
  });

  it("rejects invalid limits", async () => {
    await expect(mapWithConcurrency([1], 0, async () => 1)).rejects.toThrow(/positive integer/);
    await expect(mapWithConcurrency([1], 1.5, async () => 1)).rejects.toThrow(/positive integer/);
  });

  it("propagates the first error", async () => {
    await expect(mapWithConcurrency([1, 2], 1, async (n) => {
      if (n === 2) throw new Error("boom");
      return n;
    })).rejects.toThrow("boom");
  });
});
