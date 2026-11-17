import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse, stringify } from "yaml";
import { ConfigError, isLoopActive, loadConfig, parseConfig } from "./config";
import { isTaskType, TASK_TYPES } from "./types";

const REPO_YAML = readFileSync("harness.config.yaml", "utf8");
const base = (): Record<string, unknown> => parse(REPO_YAML);
const withChange = (change: (c: Record<string, unknown>) => void) => {
  const c = base();
  change(c);
  return stringify(c);
};
const errorOf = (yamlText: string): string => {
  try {
    parseConfig(yamlText);
  } catch (e) {
    expect(e).toBeInstanceOf(ConfigError);
    return (e as Error).message;
  }
  throw new Error("expected parseConfig to throw");
};

const SECTION_14_KEYS = [
  "project", "harness_version", "phase", "min_tests_for_auto_merge", "checks", "setup", "intake",
  "semantic", "auto_merge", "pr_only", "plan_only", "ladder", "protected_paths",
  "max_tasks_per_night", "max_features_per_night", "max_diff_lines", "budget_usd_month",
];

describe("config", () => {
  it("loads the repo harness.config.yaml with every section 14 field", () => {
    const cfg = loadConfig();
    expect(Object.keys(cfg).sort()).toEqual([...SECTION_14_KEYS].sort());
    expect(cfg.phase).toBe("solo-dev");
    expect(cfg.auto_merge).toEqual(["docs", "tidy", "tests"]);
    expect(cfg.ladder.bugfix).toEqual(["sonnet", "opus"]);
    expect(cfg.protected_paths).toEqual(expect.arrayContaining([".github/", "harness/", "harness.config.yaml", "CLAUDE.md"]));
    expect(cfg.max_diff_lines).toBe(150);
  });

  it("isLoopActive is true only for solo-dev", () => {
    const cfg = loadConfig();
    expect(isLoopActive(cfg)).toBe(true);
    expect(isLoopActive({ ...cfg, phase: "open-source" })).toBe(false);
  });

  it("isTaskType accepts the six types and rejects others", () => {
    for (const t of TASK_TYPES) expect(isTaskType(t)).toBe(true);
    expect(TASK_TYPES).toHaveLength(6);
    expect(isTaskType("chore")).toBe(false);
    expect(isTaskType("")).toBe(false);
  });

  it.each(SECTION_14_KEYS)("each required field, when missing, fails and names it: %s", (key) => {
    expect(errorOf(withChange((c) => delete c[key]))).toContain(key);
  });

  it("wrong field type fails and names it", () => {
    expect(errorOf(withChange((c) => (c.max_diff_lines = "lots")))).toContain("max_diff_lines");
  });

  it("two bad fields are both named in one error", () => {
    const msg = errorOf(withChange((c) => { c.setup = ""; c.budget_usd_month = -1; }));
    expect(msg).toContain("setup");
    expect(msg).toContain("budget_usd_month");
  });

  it("nested field path is named", () => {
    expect(errorOf(withChange((c) => ((c.ladder as Record<string, unknown>).tidy = ["gpt"])))).toContain("ladder.tidy");
  });

  it("non-semver harness_version fails", () => {
    expect(errorOf(withChange((c) => (c.harness_version = "v1")))).toContain("harness_version");
  });

  it("unknown task type in auto_merge fails and names the field", () => {
    expect(errorOf(withChange((c) => (c.auto_merge = ["docs", "chore"])))).toContain("auto_merge");
  });

  it("unknown ladder model fails and names the field", () => {
    expect(errorOf(withChange((c) => ((c.ladder as Record<string, unknown>).docs = ["gpt-9"])))).toContain("ladder.docs");
  });

  it("type in two merge lists fails", () => {
    expect(errorOf(withChange((c) => (c.pr_only = ["bugfix", "feature", "docs"])))).toMatch(/"docs" is also in auto_merge/);
  });

  it("auto_merge: [] is valid (section 15)", () => {
    expect(parseConfig(withChange((c) => (c.auto_merge = []))).auto_merge).toEqual([]);
  });

  it("runnable type without a ladder fails", () => {
    expect(errorOf(withChange((c) => delete (c.ladder as Record<string, unknown>).tidy))).toMatch(/ladder.*tidy/);
  });

  it("unknown top-level key fails", () => {
    expect(errorOf(withChange((c) => (c.surprise = 1)))).toContain("surprise");
  });

  it("max_features_per_night above max_tasks_per_night fails", () => {
    expect(errorOf(withChange((c) => (c.max_features_per_night = 4)))).toContain("max_features_per_night");
  });

  it("invalid YAML fails with a ConfigError", () => {
    expect(errorOf("project: [unclosed")).toMatch(/YAML/i);
  });

  it("loadConfig prefixes the path in errors", () => {
    const path = join(mkdtempSync(join(tmpdir(), "cfg-")), "bad.yaml");
    writeFileSync(path, withChange((c) => delete c.phase));
    expect(() => loadConfig(path)).toThrow(path);
  });
});
