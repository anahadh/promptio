import type { CheckRun, PrData } from "./types";

/** Test fixtures shared by the gate tests. */
export const check = (name: string, conclusion: string | null = "success", startedAt = "2026-11-17T01:00:00Z"): CheckRun => ({
  name,
  status: conclusion === null ? "in_progress" : "completed",
  conclusion,
  startedAt,
});

/** A docs PR that passes every rule. Tests change one thing at a time. */
export const goodPr = (over: Partial<PrData> = {}): PrData => ({
  labels: ["type:docs"],
  branch: "bot/P-1-fix-readme",
  files: [{ path: "README.md", previousPath: null, status: "modified" }],
  additions: 10,
  deletions: 2,
  checks: [check("checks"), check("pr-format")],
  testCount: 300,
  fromFork: false,
  ...over,
});

export const file = (path: string, status = "modified", previousPath: string | null = null) => ({ path, previousPath, status });
