import { describe, it, expect, vi } from "vitest";
import { formatMemoryUsage, runWithCompanyCacheRelease } from "./precompute-batch";
import { detachString } from "./dfp-parser";

describe("runWithCompanyCacheRelease", () => {
  it("releases the company caches after successful work", async () => {
    const release = vi.fn();
    const result = await runWithCompanyCacheRelease("WEGE3", "5410", async () => "ok", release);
    expect(result).toBe("ok");
    expect(release).toHaveBeenCalledExactlyOnceWith("WEGE3", "5410");
  });

  it("releases the company caches when the work throws, and rethrows", async () => {
    const release = vi.fn();
    await expect(
      runWithCompanyCacheRelease("WEGE3", "5410", async () => { throw new Error("download failed"); }, release),
    ).rejects.toThrow("download failed");
    expect(release).toHaveBeenCalledExactlyOnceWith("WEGE3", "5410");
  });

  it("releases only after the work has finished", async () => {
    const order: string[] = [];
    await runWithCompanyCacheRelease("A", "1", async () => {
      await new Promise(r => setTimeout(r, 1));
      order.push("work");
    }, () => order.push("release"));
    expect(order).toEqual(["work", "release"]);
  });
});

describe("formatMemoryUsage", () => {
  it("reports heapUsed, heapTotal, rss and external in MB", () => {
    const MB = 1024 * 1024;
    expect(formatMemoryUsage({ heapUsed: 42 * MB, heapTotal: 80 * MB, rss: 310 * MB, external: 25 * MB, arrayBuffers: 20 * MB }))
      .toBe("heapUsed=42MB heapTotal=80MB rss=310MB external=25MB");
  });
});

describe("detachString", () => {
  it("returns an equal string", () => {
    const big = "x".repeat(1000) + ";Receita de Venda de Bens e/ou Serviços;" + "y".repeat(1000);
    const slice = big.split(";")[1];
    expect(detachString(slice)).toBe("Receita de Venda de Bens e/ou Serviços");
    expect(detachString("")).toBe("");
    expect(detachString("3.01")).toBe("3.01");
  });
});
