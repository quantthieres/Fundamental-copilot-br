import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "fs";
import { dirname, join, relative, resolve } from "path";

// The application runtime (API route, report page, dashboard, coverage pages)
// reads committed holding caches only. Source access — CVM downloads, the
// Itaúsa page parser, the Bradespar bulletin/PDF parser and unpdf — is
// precompute/test-side and must never enter the request path or a browser bundle.

const ROOT = process.cwd();
const RUNTIME_ENTRIES = [
  "src/app/api/holdings/analysis/[ticker]/route.ts",
  "src/app/relatorio/[ticker]/page.tsx",
  "src/app/dashboard/page.tsx",
  "src/components/dashboard/DashboardPageClient.tsx",
  "src/components/dashboard/HoldingAnalysisPanel.tsx",
  "src/app/cobertura/page.tsx",
  "src/app/metodologia/page.tsx",
  "src/app/api/coverage/[ticker]/route.ts",
];
const PRECOMPUTE_ONLY = [
  "src/lib/holdings/bradespar-pdf-text.ts",
  "src/lib/holdings/bradespar-bulletin.ts",
  "src/lib/holdings/itausa-portfolio.ts",
  "src/lib/holdings/holding-portfolio-sources.ts",
  "src/lib/holdings/holding-cvm-client.ts",
  "src/lib/holdings/holding-refresh.ts",
];

function resolveImport(from: string, spec: string): string | null {
  const base = spec.startsWith("@/") ? join(ROOT, "src", spec.slice(2)) : spec.startsWith(".") ? resolve(dirname(from), spec) : null;
  if (!base) return null;
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]) {
    if (existsSync(candidate) && !candidate.endsWith("/")) {
      try { readFileSync(candidate); return candidate; } catch { /* directory */ }
    }
  }
  return null;
}

/** Value (non type-only) imports, transitively, plus every bare package specifier seen. */
function importGraph(entries: string[]): { files: Set<string>; packages: Set<string> } {
  const files = new Set<string>();
  const packages = new Set<string>();
  const queue = entries.map(e => join(ROOT, e));
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (files.has(file)) continue;
    files.add(file);
    const src = readFileSync(file, "utf-8");
    const specs = [
      ...[...src.matchAll(/^\s*import\s+(?!type\b)[^;]*?from\s+["']([^"']+)["']/gm)].map(m => m[1]),
      ...[...src.matchAll(/^\s*export\s+(?!type\b)[^;]*?from\s+["']([^"']+)["']/gm)].map(m => m[1]),
      ...[...src.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g)].map(m => m[1]),
    ];
    for (const spec of specs) {
      const target = resolveImport(file, spec);
      if (target) queue.push(target);
      else if (!spec.startsWith(".") && !spec.startsWith("@/")) packages.add(spec);
    }
  }
  return { files, packages };
}

describe("holding model — runtime/precompute boundary", () => {
  const { files, packages } = importGraph(RUNTIME_ENTRIES);
  const rel = new Set([...files].map(f => relative(ROOT, f)));

  it("the runtime graph reaches the holding cache reader and the panel", () => {
    expect(rel).toContain("src/lib/holdings/holding-cache.ts");
    expect(rel).toContain("src/lib/holdings/holding-analysis.ts");
    expect(rel).toContain("src/components/dashboard/HoldingAnalysisPanel.tsx");
  });

  it("never imports unpdf or a source parser/fetcher", () => {
    expect([...packages].filter(p => p === "unpdf" || p.startsWith("unpdf/"))).toEqual([]);
    for (const f of PRECOMPUTE_ONLY) expect(rel.has(f), f).toBe(false);
  });

  it("the client panel imports no server module (fs, cache reader)", () => {
    const panel = importGraph(["src/components/dashboard/HoldingAnalysisPanel.tsx", "src/components/dashboard/DashboardPageClient.tsx"]);
    const panelRel = [...panel.files].map(f => relative(ROOT, f));
    expect(panelRel).not.toContain("src/lib/holdings/holding-cache.ts");
    expect([...panel.packages].filter(p => p === "fs" || p === "path" || p === "unpdf")).toEqual([]);
  });

  it("only the precompute-side PDF module imports unpdf", () => {
    const sources = PRECOMPUTE_ONLY.filter(f => readFileSync(join(ROOT, f), "utf-8").includes('from "unpdf"'));
    expect(sources).toEqual(["src/lib/holdings/bradespar-pdf-text.ts"]);
  });
});
