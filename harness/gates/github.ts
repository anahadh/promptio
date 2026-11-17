import { execFileSync } from "node:child_process";
import { z } from "zod";
import type { PrData } from "./types";

/** Zod schemas for the GitHub and vitest JSON the gates read (validated at the edge). */

const Pull = z.object({
  number: z.number().int(),
  head: z.object({ ref: z.string(), sha: z.string() }),
  labels: z.array(z.object({ name: z.string() })),
  additions: z.number().int().nonnegative(),
  deletions: z.number().int().nonnegative(),
});
const File = z.object({ filename: z.string(), status: z.string(), previous_filename: z.string().optional() });
const CheckRunsPage = z.object({
  check_runs: z.array(
    z.object({ name: z.string(), status: z.string(), conclusion: z.string().nullable(), started_at: z.string().nullable() }),
  ),
});
/** `gh api --paginate --slurp` wraps each page in an outer array. */
const pages = <T extends z.ZodType>(item: T) => z.array(item);
const VitestList = z.array(z.object({ name: z.string(), file: z.string() }));

function parse<T extends z.ZodType>(schema: T, data: unknown, what: string): z.infer<T> {
  const r = schema.safeParse(data);
  if (r.success) return r.data;
  const where = r.error.issues.map((i) => `${[what, ...i.path].join(".")}: ${i.message}`).join("; ");
  throw new Error(`unexpected ${what} JSON: ${where}`);
}

export function toPrData(pull: unknown, files: unknown, checkRuns: unknown, testCount: number): PrData {
  const p = parse(Pull, pull, "pull");
  const f = parse(pages(z.array(File)), files, "files").flat();
  const c = parse(pages(CheckRunsPage), checkRuns, "check_runs").flatMap((page) => page.check_runs);
  return {
    labels: p.labels.map((l) => l.name),
    branch: p.head.ref,
    files: f.map((x) => ({ path: x.filename, previousPath: x.previous_filename ?? null, status: x.status })),
    additions: p.additions,
    deletions: p.deletions,
    checks: c.map((x) => ({ name: x.name, status: x.status, conclusion: x.conclusion, startedAt: x.started_at ?? "" })),
    testCount,
  };
}

export function countTests(vitestListJson: unknown): number {
  return parse(VitestList, vitestListJson, "vitest list").length;
}

/** True when the PR head is no longer the commit this run was triggered for. */
export function isStale(pull: unknown, sha: string): boolean {
  return parse(Pull, pull, "pull").head.sha !== sha;
}

export const pullNumber = (pull: unknown): number => parse(Pull, pull, "pull").number;

/** Finds the open PR whose head is this commit (workflow_run may not list it). */
export function prForSha(commitPulls: unknown, sha: string): number | null {
  const list = parse(z.array(z.object({ number: z.number(), state: z.string(), head: z.object({ sha: z.string() }) })), commitPulls, "commit pulls");
  return list.find((p) => p.state === "open" && p.head.sha === sha)?.number ?? null;
}

/** Runs `gh api` and parses its JSON output. */
export function ghJson(args: string[]): unknown {
  return JSON.parse(execFileSync("gh", ["api", ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }));
}

export const headSha = (pull: unknown): string => parse(Pull, pull, "pull").head.sha;
