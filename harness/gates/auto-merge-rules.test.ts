import { describe, expect, it } from "vitest";
import { loadConfig } from "../config";
import { evaluateAutoMerge, gateStatus, isProtected } from "./auto-merge";
import { check, file, goodPr } from "./fixtures";
import type { PrData } from "./types";

const cfg = loadConfig();
const gate = (over: Partial<PrData>, c = cfg) => evaluateAutoMerge(goodPr(over), c);

describe("auto-merge: rule 3 (size and protected paths)", () => {
  it("diff over max_diff_lines blocks", () => {
    const r = gate({ additions: 140, deletions: 11 });
    expect(r.allowed).toBe(false);
    expect(r.reasons.join()).toMatch(/151 changed lines.*150/);
  });
  it("diff exactly at max_diff_lines is allowed", () => {
    expect(gate({ additions: 100, deletions: 50 }).allowed).toBe(true);
  });
  it.each([".github/workflows/ci.yml", "harness/config.ts", "extension/lib/keys.ts", "package.json"])(
    "protected path touched blocks: %s",
    (path) => {
      const r = gate({ labels: ["type:tidy"], files: [file(path)] });
      expect(r.allowed).toBe(false);
      expect(r.reasons.join()).toContain(`protected path ${path}`);
    },
  );
  it.each(["CLAUDE.md", "harness.config.yaml"])("agent instructions and loop config are protected: %s", (path) => {
    const r = gate({ labels: [path.endsWith(".md") ? "type:docs" : "type:tidy"], files: [file(path)] });
    expect(r.allowed).toBe(false);
    expect(r.reasons.join()).toContain(`protected path ${path}`);
  });
  it("rename out of a protected path blocks", () => {
    const r = gate({ files: [file("NOTES.md", "renamed", "harness/NOTES.md")] });
    expect(r.allowed).toBe(false);
    expect(r.reasons.join()).toContain("protected path harness/NOTES.md");
  });
  it("protected prefix doesn't match a similar name", () => {
    const paths = ["harness/", "package.json", "extension/lib/keys.ts"];
    expect(isProtected("harness.config.yaml", paths)).toBe(false);
    expect(isProtected("package.json.bak", paths)).toBe(false);
    expect(isProtected("extension/lib/keys.test.ts", paths)).toBe(false);
    expect(isProtected("harness/x.ts", paths)).toBe(true);
    expect(isProtected("package.json", paths)).toBe(true);
  });
});

describe("auto-merge: rule 5 (branch name)", () => {
  it.each(["main", "bot/foo", "bot/p-1-x", "bot/P-1-", "bot/P-1-Fix", "feature/P-1-x", "bot/P-1-x/y"])("wrong branch name blocks: %s", (branch) => {
    const r = gate({ branch });
    expect(r.allowed).toBe(false);
    expect(r.reasons.join()).toContain(`branch "${branch}"`);
  });
  it("valid branch name is allowed", () => {
    for (const branch of ["bot/P-14-emoji-spans", "bot/R-3-fix", "bot/P-2-a1"]) expect(gate({ branch }).allowed).toBe(true);
  });
});

describe("auto-merge: project-wide", () => {
  it("PR from a fork is blocked", () => {
    const r = gate({ fromFork: true });
    expect(r.allowed).toBe(false);
    expect(r.reasons.join()).toMatch(/fork/);
  });

  it("below min_tests_for_auto_merge blocks every type", () => {
    for (const t of ["docs", "tidy", "tests"]) {
      const r = gate({ labels: [`type:${t}`], files: [file(t === "tests" ? "a.test.ts" : "README.md")], testCount: 4 });
      expect(r.allowed).toBe(false);
      expect(r.reasons.join()).toMatch(/4 tests.*min_tests_for_auto_merge 5/);
    }
    expect(gate({ testCount: 5 }).allowed).toBe(true);
  });
  it("collects every failing reason, not just the first", () => {
    const r = gate({
      labels: [],
      branch: "main",
      files: [file("package.json")],
      additions: 500,
      deletions: 0,
      checks: [check("checks", "failure")],
      testCount: 0,
    });
    expect(r.allowed).toBe(false);
    expect(r.reasons.length).toBeGreaterThanOrEqual(6);
  });
});

describe("gateStatus", () => {
  it("maps an allowed result to success", () => {
    expect(gateStatus({ allowed: true, reasons: [] })).toEqual({ state: "success", description: "Passes every auto-merge rule" });
  });
  it("maps a result waiting only on checks to pending", () => {
    expect(gateStatus({ allowed: false, reasons: ['check "checks" is in_progress', 'check "pr-format" has not run'] }).state).toBe("pending");
  });
  it("maps any other block to failure with the first reason", () => {
    const r = gateStatus({ allowed: false, reasons: ['check "checks" is in_progress', "touches protected path package.json"] });
    expect(r.state).toBe("failure");
    expect(r.description).toContain("touches protected path package.json");
  });
  it("keeps the description within GitHub's 140-character limit", () => {
    expect(gateStatus({ allowed: false, reasons: ["x".repeat(300)] }).description.length).toBeLessThanOrEqual(140);
  });
});
