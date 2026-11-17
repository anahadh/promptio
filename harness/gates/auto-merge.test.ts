import { describe, expect, it } from "vitest";
import { loadConfig } from "../config";
import { evaluateAutoMerge } from "./auto-merge";
import { check, file, goodPr } from "./fixtures";
import type { PrData } from "./types";

const cfg = loadConfig();
const gate = (over: Partial<PrData>, c = cfg) => evaluateAutoMerge(goodPr(over), c);
const blocked = (over: Partial<PrData>, pattern: RegExp) => {
  const r = gate(over);
  expect(r.allowed).toBe(false);
  expect(r.reasons.join("\n")).toMatch(pattern);
};

describe("auto-merge: per-type file rules", () => {
  it("docs PR with only *.md files outside docs/ is allowed", () => {
    expect(gate({ files: [file("README.md"), file("extension/NOTES.md", "added")] })).toEqual({ allowed: true, reasons: [] });
  });
  it("docs PR touching a .ts file is blocked", () => blocked({ files: [file("README.md"), file("core/types.ts")] }, /core\/types\.ts/));
  it("docs PR touching docs/ is blocked", () => blocked({ files: [file("docs/plan/x.md")] }, /docs\/plan\/x\.md/));

  it("tidy PR with no test files is allowed", () => {
    expect(gate({ labels: ["type:tidy"], files: [file("core/scale.ts")] }).allowed).toBe(true);
  });
  it("tidy PR changing a test file is blocked", () =>
    blocked({ labels: ["type:tidy"], files: [file("core/scale.ts"), file("core/scale.test.ts")] }, /tidy.*core\/scale\.test\.ts/));

  it("tests PR with only *.test.ts files is allowed", () => {
    expect(gate({ labels: ["type:tests"], files: [file("core/scale.test.ts"), file("core/new.test.ts", "added")] }).allowed).toBe(true);
  });
  it("tests PR with a non-test file is blocked", () =>
    blocked({ labels: ["type:tests"], files: [file("core/scale.test.ts"), file("core/scale.ts")] }, /tests.*core\/scale\.ts/));
  it("tests PR deleting a non-test file is blocked", () =>
    blocked({ labels: ["type:tests"], files: [file("core/scale.test.ts"), file("core/old.ts", "removed")] }, /core\/old\.ts/));
});

describe("auto-merge: rule 1 (type label)", () => {
  it.each(["bugfix", "feature", "design"])("bugfix, feature and design PRs are blocked by rule 1 alone: %s", (t) => {
    expect(gate({ labels: [`type:${t}`] })).toEqual({ allowed: false, reasons: [expect.stringMatching(new RegExp(`type:${t}.*never auto-merge`))] });
  });
  it("bugfix stays blocked even if the config lists it in auto_merge", () => {
    const loose = { ...cfg, auto_merge: [...cfg.auto_merge, "bugfix" as const], pr_only: ["feature" as const] };
    expect(gate({ labels: ["type:bugfix"] }, loose).allowed).toBe(false);
  });
  it("missing type label blocks", () => blocked({ labels: ["enhancement"] }, /no type: label/));
  it("two type labels block", () => blocked({ labels: ["type:docs", "type:tidy"] }, /more than one type: label/));
  it("unknown type label blocks", () => blocked({ labels: ["type:chore"] }, /unknown type label "type:chore"/));
  it("auto_merge: [] blocks every type", () => {
    for (const t of ["docs", "tidy", "tests"]) {
      const r = gate({ labels: [`type:${t}`], files: [file(t === "tests" ? "a.test.ts" : "README.md")] }, { ...cfg, auto_merge: [] });
      expect(r.allowed).toBe(false);
      expect(r.reasons.join()).toMatch(/not in auto_merge/);
    }
  });
});

describe("auto-merge: rule 2 (checks)", () => {
  it("failed checks job blocks and names it", () => blocked({ checks: [check("checks", "failure"), check("pr-format")] }, /check "checks" is failure/));
  it("failed pr-format blocks and names it", () => blocked({ checks: [check("checks"), check("pr-format", "failure")] }, /check "pr-format" is failure/));
  it("pending required check blocks", () => blocked({ checks: [check("checks", null), check("pr-format")] }, /check "checks" is in_progress/));
  it("missing required check blocks", () => blocked({ checks: [check("checks")] }, /check "pr-format" has not run/));
  it("latest run of a check wins over an older failure", () => {
    const checks = [check("checks", "success", "2026-11-17T02:00:00Z"), check("checks", "failure", "2026-11-17T01:00:00Z"), check("pr-format")];
    expect(gate({ checks }).allowed).toBe(true);
    const flipped = [check("checks", "success", "2026-11-17T01:00:00Z"), check("checks", "failure", "2026-11-17T02:00:00Z"), check("pr-format")];
    expect(gate({ checks: flipped }).allowed).toBe(false);
  });
});
