import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { REQUIRED_CHECKS } from "./gates/auto-merge";

/** Static checks on the gate workflows: they only route events to the harness scripts. */

interface Step { uses?: string; run?: string; with?: Record<string, unknown>; if?: string }
interface Job { if?: string; needs?: string | string[]; permissions?: Record<string, string>; steps: Step[] }
interface Workflow { name: string; on: Record<string, { types?: string[]; workflows?: string[] }>; jobs: Record<string, Job> }

const load = (f: string) => parse(readFileSync(`.github/workflows/${f}`, "utf8")) as Workflow;
const GATES = ["auto-merge.yml", "pr-format.yml", "bugfix-proof.yml"] as const;
const wf = Object.fromEntries(GATES.map((f) => [f, load(f)])) as Record<(typeof GATES)[number], Workflow>;
const ci = load("ci.yml");
const jobsOf = (w: Workflow) => Object.entries(w.jobs);
const needsOf = (j: Job) => (j.needs === undefined ? [] : [j.needs].flat());
const isWrite = (j: Job) => Object.values(j.permissions ?? {}).includes("write");
const checkouts = (j: Job) => j.steps.filter((s) => s.uses?.startsWith("actions/checkout"));

const ALLOWED_RUN = [
  /^npm ci( --prefix (head|base))?$/,
  /^npx tsx harness\/gates\/[\w-]+\.ts( --sha "\$SHA")?$/,
  /^base\/node_modules\/\.bin\/tsx base\/harness\/gates\/fbpa-cli\.ts /,
  /^git -C head diff --name-only --diff-filter=d /,
  /^gh pr (merge|edit) "\$PR" /,
];

describe("gate workflows", () => {
  it("every gate workflow runs only on bot/* branches", () => {
    for (const w of Object.values(wf)) {
      const guarded = new Set<string>();
      for (const [name, job] of jobsOf(w)) {
        // Each event branch of a condition needs its own bot/ guard.
        const events = job.if?.match(/github\.event_name == /g)?.length ?? 0;
        const guards = job.if?.match(/'bot\/'/g)?.length ?? 0;
        // A dependency's guard only carries over if this job can't run when that dependency is skipped.
        const runsAnyway = /always\(\)|cancelled\(\)/.test(job.if ?? "");
        const inherits = needsOf(job).some((n) => guarded.has(n) && (!runsAnyway || job.if!.includes(`needs.${n}.result != 'skipped'`)));
        if ((guards > 0 && guards >= events) || inherits) guarded.add(name);
      }
      expect(jobsOf(w).map(([n]) => n).filter((n) => !guarded.has(n)), w.name).toEqual([]);
    }
  });

  it("run steps call only harness scripts, npm ci, git or gh pr", () => {
    for (const w of Object.values(wf)) {
      for (const [, job] of jobsOf(w)) {
        for (const s of job.steps) {
          if (s.run) expect(ALLOWED_RUN.some((r) => r.test(s.run!.trim())), s.run).toBe(true);
          if (s.uses) expect(s.uses).toMatch(/^actions\/(checkout|setup-node)@v\d+$/);
        }
      }
    }
  });

  it("auto-merge uses gh pr merge --auto --squash with --match-head-commit and never closes", () => {
    const runs = jobsOf(wf["auto-merge.yml"]).flatMap(([, j]) => j.steps.map((s) => s.run ?? ""));
    expect(runs.filter((r) => r.includes("--auto ")).every((r) => /gh pr merge "\$PR" --auto --squash --match-head-commit "\$SHA"/.test(r))).toBe(true);
    expect(runs.some((r) => r.includes("--auto --squash"))).toBe(true);
    expect(wf["auto-merge.yml"].jobs.merge?.if).toBe("needs.gate.outputs.allowed == 'true'");
    for (const w of Object.values(wf)) expect(JSON.stringify(w)).not.toMatch(/gh pr close|--admin/);
  });

  it("auto-merge disables auto-merge first on synchronize", () => {
    const { jobs } = wf["auto-merge.yml"];
    expect(jobs["disable-on-push"]?.if).toContain("synchronize");
    expect(jobs["disable-on-push"]?.steps[0]?.run).toMatch(/--disable-auto/);
    expect(jobs["disable-on-push"]?.steps).toHaveLength(1);
    expect(needsOf(jobs.gate!)).toContain("disable-on-push");
  });

  it("write-token jobs never check out PR code", () => {
    for (const w of Object.values(wf)) {
      for (const [name, job] of jobsOf(w)) if (isWrite(job)) expect(checkouts(job), `${w.name}/${name}`).toEqual([]);
    }
    // auto-merge's read job checks out the base (no ref), never the PR head.
    for (const c of checkouts(wf["auto-merge.yml"].jobs.gate!)) expect(c.with?.ref).toBeUndefined();
    expect(Object.keys(wf["auto-merge.yml"].on).sort()).toEqual(["pull_request_target", "workflow_run"]);
  });

  it("jobs that run PR code have read-only permissions", () => {
    for (const w of Object.values(wf)) {
      for (const [name, job] of jobsOf(w)) {
        if (checkouts(job).length === 0) continue;
        expect(isWrite(job), `${w.name}/${name}`).toBe(false);
        for (const c of checkouts(job)) expect(c.with?.["persist-credentials"]).toBe(false);
      }
    }
    expect(wf["pr-format.yml"].jobs["pr-format"]?.steps[0]?.with?.ref).toBe("${{ github.base_ref }}");
  });

  it("workflow_run names match the CI and PR format workflow names", () => {
    expect(wf["auto-merge.yml"].on.workflow_run?.workflows).toEqual([ci.name, wf["pr-format.yml"].name]);
  });

  it("required check names match workflow job names", () => {
    expect(REQUIRED_CHECKS).toEqual(["checks", "pr-format"]);
    expect(Object.keys(ci.jobs)).toContain("checks");
    expect(Object.keys(wf["pr-format.yml"].jobs)).toEqual(["pr-format"]);
  });

  it("pr-format re-runs on edited", () => {
    expect(wf["pr-format.yml"].on.pull_request?.types).toEqual(expect.arrayContaining(["opened", "synchronize", "edited"]));
    expect(wf["auto-merge.yml"].on.pull_request_target?.types).toEqual(expect.arrayContaining(["synchronize", "labeled", "unlabeled", "edited"]));
  });

  it("bugfix-proof runs only for type:bugfix and both adds and removes the label", () => {
    const { jobs } = wf["bugfix-proof.yml"];
    expect(jobs["fail-before-pass-after"]?.if).toContain("contains(github.event.pull_request.labels.*.name, 'type:bugfix')");
    const runs = jobs.label!.steps.map((s) => `${s.if} => ${s.run}`);
    expect(runs).toEqual([
      expect.stringMatching(/proven == 'false' => gh pr edit "\$PR" --add-label unproven-fix/),
      expect.stringMatching(/proven == 'true' => gh pr edit "\$PR" --remove-label unproven-fix/),
    ]);
  });
});
