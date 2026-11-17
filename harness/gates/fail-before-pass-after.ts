import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";
import { isTestFile } from "./auto-merge";
import type { ChangedFile } from "./types";

/**
 * Fail-before/pass-after check for bugfix PRs (spec section 6). The PR's changed
 * test files must fail against the base code and pass against the PR code.
 */

export interface RunSummary {
  /** Tests that ran (passed + failed). */
  ran: number;
  /** Tests whose assertions failed. */
  failed: number;
  /** Test files that failed before any test ran (import or syntax errors). */
  collectionErrors: number;
}
export type TestRunner = (dir: string, files: string[]) => Promise<RunSummary>;
export interface Proof { proven: boolean; reasons: string[]; label: "unproven-fix" | null }

const VitestJson = z.object({
  numPassedTests: z.number(),
  numFailedTests: z.number(),
  testResults: z.array(z.object({ status: z.string(), assertionResults: z.array(z.unknown()) })),
});

/** Reads vitest's JSON reporter output. */
export function summarize(vitestJson: unknown): RunSummary {
  const j = VitestJson.parse(vitestJson);
  return {
    ran: j.numPassedTests + j.numFailedTests,
    failed: j.numFailedTests,
    collectionErrors: j.testResults.filter((t) => t.status === "failed" && t.assertionResults.length === 0).length,
  };
}

/** Test files the PR adds or changes (removed ones can't run). */
export const testFilesOf = (files: ChangedFile[]): string[] =>
  files.filter((f) => isTestFile(f.path) && f.status !== "removed").map((f) => f.path);

const defaultCopy = (from: string, to: string) => {
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
};

export async function proveFix(input: {
  files: ChangedFile[];
  baseDir: string;
  headDir: string;
  run: TestRunner;
  copy?: (from: string, to: string) => void;
}): Promise<Proof> {
  const { files, baseDir, headDir, run, copy = defaultCopy } = input;
  const tests = testFilesOf(files);
  const unproven = (reasons: string[]): Proof => ({ proven: false, reasons, label: "unproven-fix" });
  if (tests.length === 0) return unproven(["no test file was added or changed"]);

  for (const t of tests) copy(join(headDir, t), join(baseDir, t));
  const base = await run(baseDir, tests);
  const head = await run(headDir, tests);

  const reasons: string[] = [];
  if (base.failed === 0) {
    reasons.push(
      base.collectionErrors > 0
        ? "tests did not fail on the base branch (only a collection error, e.g. a missing import, which proves nothing)"
        : "tests did not fail on the base branch, so they don't show the bug",
    );
  }
  if (head.failed > 0 || head.collectionErrors > 0) reasons.push("tests fail on the PR branch");
  else if (head.ran === 0) reasons.push("no tests ran on the PR branch");
  return reasons.length ? unproven(reasons) : { proven: true, reasons: [], label: null };
}
