/**
 * Changed-file guard for the scheduled cache refresh workflow.
 *
 * Usage:
 *   tsx scripts/cache-refresh-guard.ts normalize
 *     Restores (git checkout) cache files whose only change is the provenance
 *     timestamp, and the quote-only audit markdown when only its date changed.
 *     Prevents weekly commits that touch every cache without new data.
 *
 *   tsx scripts/cache-refresh-guard.ts check [--list-out <file>]
 *     Fails (exit 1) if any changed path is outside the allowed cache
 *     directories, if any file was deleted/renamed, or if any refreshed cache
 *     lost history compared to HEAD. On success writes the approved paths
 *     (one per line) to <file> for `git add --pathspec-from-file`.
 *     Prints "No cache changes detected" when the working tree is clean.
 *
 * Rules live in src/lib/cache-refresh/refresh-guard.ts (unit-tested).
 * Read-only except for `normalize` restoring files to their HEAD version.
 */

import { execFileSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";

import {
  AUDIT_DOC_PATH,
  classifyRefreshPaths,
  detectCacheRegression,
  isDateOnlyAuditDocChange,
  isTimestampOnlyJsonChange,
  isUnexpectedStatus,
  parsePorcelainZ,
  type ChangedPath,
} from "../src/lib/cache-refresh/refresh-guard";

const GUARD_OPTIONS = { allowAuditDoc: true };

function git(args: string[]): string {
  return execFileSync("git", args, { encoding: "utf-8", maxBuffer: 256 * 1024 * 1024 });
}

function changedPaths(): ChangedPath[] {
  return parsePorcelainZ(git(["status", "--porcelain=v1", "-z", "--untracked-files=all"]));
}

function headVersion(path: string): string | null {
  try {
    return git(["show", `HEAD:${path}`]);
  } catch {
    return null;
  }
}

function normalize(): void {
  const restore: string[] = [];
  for (const { status, path } of changedPaths()) {
    if (status !== " M") continue;
    const { safe } = classifyRefreshPaths([path], GUARD_OPTIONS);
    if (safe.length === 0) continue; // unsafe paths are left for `check` to report
    const before = headVersion(path);
    if (before === null) continue;
    const after = readFileSync(path, "utf-8");
    const unchanged = path === AUDIT_DOC_PATH
      ? isDateOnlyAuditDocChange(before, after)
      : isTimestampOnlyJsonChange(before, after);
    if (unchanged) restore.push(path);
  }

  // Batch to keep the argument list well below OS limits.
  for (let i = 0; i < restore.length; i += 200) {
    git(["checkout", "--", ...restore.slice(i, i + 200)]);
  }
  console.log(`[guard] restored ${restore.length} file(s) whose only change was a timestamp`);
}

function check(listOut: string | null): void {
  const changes = changedPaths();
  if (listOut) writeFileSync(listOut, "", "utf-8");

  if (changes.length === 0) {
    console.log("No cache changes detected");
    return;
  }

  const failures: string[] = [];

  const { safe, unsafe } = classifyRefreshPaths(changes.map(c => c.path), GUARD_OPTIONS);
  for (const p of unsafe) failures.push(`unsafe path: ${p}`);

  for (const { status, path } of changes) {
    if (isUnexpectedStatus(status)) failures.push(`unexpected git status "${status}": ${path}`);
  }

  for (const path of safe) {
    if (path === AUDIT_DOC_PATH) continue;
    const before = headVersion(path);
    let after: string;
    try {
      after = readFileSync(path, "utf-8");
    } catch {
      continue; // deleted — already reported via status
    }
    for (const problem of detectCacheRegression(path, before, after)) {
      failures.push(`data regression: ${path}: ${problem}`);
    }
  }

  if (failures.length > 0) {
    console.error(`[guard] REJECTED — ${failures.length} problem(s); nothing will be committed:`);
    for (const f of failures) console.error(`  ${f}`);
    process.exit(1);
  }

  console.log(`[guard] OK — ${safe.length} approved path(s):`);
  for (const p of safe) console.log(`  ${p}`);
  if (listOut) writeFileSync(listOut, safe.join("\n") + "\n", "utf-8");
}

function main(): void {
  const [command, ...rest] = process.argv.slice(2);
  if (command === "normalize") return normalize();
  if (command === "check") {
    const i = rest.indexOf("--list-out");
    return check(i >= 0 ? rest[i + 1] ?? null : null);
  }
  console.error("Usage: tsx scripts/cache-refresh-guard.ts <normalize|check> [--list-out <file>]");
  process.exit(2);
}

main();
