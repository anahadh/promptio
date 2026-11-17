import type { HarnessConfig } from "../config";
import { isTaskType, type TaskType } from "../types";
import type { ChangedFile, CheckRun, GateResult, PrData } from "./types";

/** Auto-merge gate (agent-loop spec section 6). Pure: every input is passed in. */

/** Check runs that must succeed: the CI job running the config's checks, and pr-format. */
export const REQUIRED_CHECKS = ["checks", "pr-format"];
/** The spec table says No / Never for these, whatever the config says. */
export const NEVER_AUTO_MERGE: readonly TaskType[] = ["bugfix", "feature", "design"];
/** bot/<task-id>-<slug>; task IDs use the intake format (harness/intake.ts). */
export const BRANCH = /^bot\/[A-Z]+-\d+-[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const isTestFile = (path: string): boolean => path.endsWith(".test.ts");

export function typeFromLabels(labels: string[]): { type: TaskType | null; reason: string | null } {
  const typeLabels = labels.filter((l) => l.startsWith("type:"));
  if (typeLabels.length === 0) return { type: null, reason: "no type: label" };
  if (typeLabels.length > 1) return { type: null, reason: `more than one type: label (${typeLabels.join(", ")})` };
  const value = typeLabels[0]!.slice("type:".length);
  if (!isTaskType(value)) return { type: null, reason: `unknown type label "${typeLabels[0]}"` };
  return { type: value, reason: null };
}

/** Entries ending in "/" match by prefix; others match the exact path. */
export function isProtected(path: string, protectedPaths: string[]): boolean {
  return protectedPaths.some((p) => (p.endsWith("/") ? path.startsWith(p) : path === p));
}

const pathsOf = (f: ChangedFile) => (f.previousPath ? [f.previousPath, f.path] : [f.path]);

/** The per-type file rules from the section 6 table. */
export function fileRuleFailures(type: TaskType, files: ChangedFile[]): string[] {
  const paths = files.flatMap(pathsOf);
  const bad = (ok: (p: string) => boolean) => paths.filter((p) => !ok(p));
  const rules: Partial<Record<TaskType, [(p: string) => boolean, string]>> = {
    docs: [(p) => p.endsWith(".md") && !p.startsWith("docs/"), "docs PRs may change only *.md files outside docs/"],
    tidy: [(p) => !isTestFile(p), "tidy PRs may not change test files"],
    tests: [isTestFile, "tests PRs may change only *.test.ts files"],
  };
  const rule = rules[type];
  if (!rule) return [`no file rule for type ${type}`];
  return bad(rule[0]).map((p) => `${rule[1]}: ${p}`);
}

/** Uses the latest run of each required check. */
export function checkFailures(checks: CheckRun[], required: string[]): string[] {
  return required.flatMap((name) => {
    const latest = checks
      .filter((c) => c.name === name)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
    if (!latest) return [`check "${name}" has not run`];
    if (latest.status !== "completed") return [`check "${name}" is ${latest.status}`];
    if (latest.conclusion !== "success") return [`check "${name}" is ${latest.conclusion ?? "unknown"}`];
    return [];
  });
}

export function evaluateAutoMerge(pr: PrData, cfg: HarnessConfig): GateResult {
  const reasons: string[] = [];
  const { type, reason } = typeFromLabels(pr.labels);

  // Rule 1: label type:<t> with t allowed to auto-merge.
  if (reason) reasons.push(reason);
  else if (type && NEVER_AUTO_MERGE.includes(type)) {
    return { allowed: false, reasons: [`type:${type} PRs never auto-merge; they wait for review`] };
  } else if (type && !cfg.auto_merge.includes(type)) reasons.push(`type ${type} is not in auto_merge`);

  // Rule 2: required checks passed.
  reasons.push(...checkFailures(pr.checks, REQUIRED_CHECKS));

  // Rule 3: size and protected paths.
  const lines = pr.additions + pr.deletions;
  if (lines > cfg.max_diff_lines) reasons.push(`${lines} changed lines exceeds max_diff_lines ${cfg.max_diff_lines}`);
  for (const p of new Set(pr.files.flatMap(pathsOf))) {
    if (isProtected(p, cfg.protected_paths)) reasons.push(`touches protected path ${p}`);
  }

  // Rule 4: the type's file rule.
  if (type && cfg.auto_merge.includes(type)) reasons.push(...fileRuleFailures(type, pr.files));

  // Rule 5: branch name.
  if (!BRANCH.test(pr.branch)) reasons.push(`branch "${pr.branch}" does not match bot/<task-id>-<slug>`);

  // Section 15: no auto-merge until the project has enough tests.
  if (pr.testCount < cfg.min_tests_for_auto_merge) {
    reasons.push(`project has ${pr.testCount} tests, below min_tests_for_auto_merge ${cfg.min_tests_for_auto_merge}`);
  }
  return { allowed: reasons.length === 0, reasons };
}
