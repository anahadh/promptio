import { describe, expect, it } from "vitest";
import { countTests, isStale, toPrData } from "./github";

const pull = {
  number: 7,
  head: { ref: "bot/P-1-x", sha: "abc", repo: { full_name: "anahadh/promptio" } },
  base: { repo: { full_name: "anahadh/promptio" } },
  labels: [{ name: "type:docs" }, { name: "x" }],
  additions: 3,
  deletions: 1,
};
const files = [[{ filename: "README.md", status: "modified" }], [{ filename: "b.md", status: "renamed", previous_filename: "a.md" }]];
const runs = [{ total_count: 1, check_runs: [{ name: "checks", status: "completed", conclusion: "success", started_at: "2026-11-17T00:00:00Z" }] }];

describe("github data", () => {
  it("maps PR, files and check-runs JSON to PrData", () => {
    expect(toPrData(pull, files, runs, 42)).toEqual({
      labels: ["type:docs", "x"],
      branch: "bot/P-1-x",
      files: [
        { path: "README.md", previousPath: null, status: "modified" },
        { path: "b.md", previousPath: "a.md", status: "renamed" },
      ],
      additions: 3,
      deletions: 1,
      checks: [{ name: "checks", status: "completed", conclusion: "success", startedAt: "2026-11-17T00:00:00Z" }],
      testCount: 42,
      fromFork: false,
    });
  });

  it("marks a PR from another repository, or a deleted fork, as fromFork", () => {
    expect(toPrData({ ...pull, head: { ...pull.head, repo: { full_name: "stranger/promptio" } } }, files, runs, 1).fromFork).toBe(true);
    expect(toPrData({ ...pull, head: { ...pull.head, repo: null } }, files, runs, 1).fromFork).toBe(true);
  });

  it("maps a renamed file with its previous path", () => {
    expect(toPrData(pull, files, runs, 1).files[1]?.previousPath).toBe("a.md");
  });

  it("rejects a pull payload missing head.ref and names it", () => {
    expect(() => toPrData({ ...pull, head: { sha: "abc", repo: pull.head.repo } }, files, runs, 1)).toThrow(/head\.ref/);
  });

  it("rejects files JSON that isn't a list", () => {
    expect(() => toPrData(pull, { filename: "x" }, runs, 1)).toThrow(/files/);
  });

  it("flattens paginated (slurped) lists", () => {
    const twoPages = [{ total_count: 2, check_runs: [runs[0]!.check_runs[0]] }, { total_count: 2, check_runs: [{ ...runs[0]!.check_runs[0], name: "pr-format", started_at: null }] }];
    const pr = toPrData(pull, files, twoPages, 1);
    expect(pr.files).toHaveLength(2);
    expect(pr.checks.map((c) => c.name)).toEqual(["checks", "pr-format"]);
    expect(pr.checks[1]?.startedAt).toBe("");
  });

  it("countTests counts vitest list entries", () => {
    expect(countTests([{ name: "a", file: "/x.test.ts" }, { name: "b", file: "/x.test.ts" }])).toBe(2);
  });

  it("countTests rejects non-list output", () => {
    expect(() => countTests({ tests: 3 })).toThrow();
  });

  it("isStale is true when the PR head moved", () => {
    expect(isStale(pull, "abc")).toBe(false);
    expect(isStale(pull, "def")).toBe(true);
  });
});
