import { describe, expect, it } from "vitest";
import { parseIntake } from "./intake";

const doc = (open: string[] = [], triage: string[] = [], done: string[] = []) =>
  ["# Problems", "", "## Open", ...open, "## Needs triage", ...triage, "## Done", ...done, ""].join("\n");
const errs = (md: string) => parseIntake(md).errors.map((e) => e.message).join("\n");

describe("parseIntake", () => {
  it("parses a tagged entry", () => {
    const r = parseIntake(doc(["- [P-14][bugfix] Decomposer drops emoji spans."]));
    expect(r.errors).toEqual([]);
    expect(r.open).toEqual([
      { id: "P-14", type: "bugfix", text: "Decomposer drops emoji spans.", section: "open", fromReviewPr: null, pr: null, prUrl: null, line: 4 },
    ]);
  });

  it("parses an untagged entry with type null", () => {
    expect(parseIntake(doc(["- [P-16] PR descriptions miss the mode"])).open[0]).toMatchObject({ id: "P-16", type: null });
  });

  it("parses a from-review entry with its PR number", () => {
    const r = parseIntake(doc([], ["- [R-3][from-review PR #42] Test may lock in a bug."]));
    expect(r.open).toEqual([]);
    expect(r.needsTriage[0]).toMatchObject({ id: "R-3", type: null, fromReviewPr: 42, section: "needs_triage", text: "Test may lock in a bug." });
  });

  it("accepts a from-review entry that was also given a type", () => {
    expect(parseIntake(doc(["- [R-3][from-review PR #42][tests] Fix the test."])).open[0]).toMatchObject({ type: "tests", fromReviewPr: 42 });
  });

  it("parses a Done entry with a PR #n link", () => {
    const r = parseIntake(doc([], [], ["- [P-9][docs] Fixed README. PR #51"]));
    expect(r.errors).toEqual([]);
    expect(r.done[0]).toMatchObject({ id: "P-9", section: "done", pr: 51, prUrl: null });
  });

  it("parses a Done entry with a full GitHub PR URL", () => {
    const r = parseIntake(doc([], [], ["- [P-9][docs] Fixed. https://github.com/anahadh/promptio/pull/51"]));
    expect(r.done[0]).toMatchObject({ pr: 51, prUrl: "https://github.com/anahadh/promptio/pull/51" });
  });

  it("reports a Done entry with no PR link", () => {
    const r = parseIntake(doc([], [], ["- [P-9][docs] Fixed README."]));
    expect(r.done[0]).toMatchObject({ id: "P-9", pr: null });
    expect(r.errors).toEqual([{ line: 6, message: expect.stringMatching(/P-9.*PR link/) }]);
  });

  it("a from-review entry in Done takes its link from the text, not the tag", () => {
    const tagOnly = parseIntake(doc([], [], ["- [R-3][from-review PR #42] Fixed."]));
    expect(tagOnly.done[0]).toMatchObject({ pr: null, fromReviewPr: 42 });
    expect(tagOnly.errors).toHaveLength(1);
    expect(parseIntake(doc([], [], ["- [R-3][from-review PR #42] Fixed. PR #60"])).done[0]).toMatchObject({ pr: 60 });
  });

  it("reports a malformed bullet with its line number", () => {
    const r = parseIntake(doc(["- no id here", "- [p-1] lowercase id"]));
    expect(r.open).toEqual([]);
    expect(r.errors.map((e) => e.line)).toEqual([4, 5]);
  });

  it("reports a continuation line instead of joining it", () => {
    const r = parseIntake(doc(["- [P-1] First line", "  second line"]));
    expect(r.open[0]?.text).toBe("First line");
    expect(r.errors).toEqual([{ line: 5, message: expect.stringMatching(/one line/) }]);
  });

  it("reports each missing section", () => {
    const r = parseIntake("## Open\n- [P-1] x\n");
    expect(r.open).toHaveLength(1);
    expect(errs("## Open\n")).toMatch(/Needs triage[\s\S]*Done/);
  });

  it("reports a duplicate section heading", () => {
    expect(errs(doc() + "## Open\n")).toMatch(/"## Open" appears twice/);
  });

  it("reports a duplicate task ID across sections and keeps the first", () => {
    const r = parseIntake(doc(["- [P-1] first"], [], ["- [P-1] again PR #3"]));
    expect(r.open).toHaveLength(1);
    expect(r.done).toEqual([]);
    expect(errs(doc(["- [P-1] first"], [], ["- [P-1] again PR #3"]))).toMatch(/P-1.*duplicate/i);
  });

  it("reports an unknown type tag", () => {
    const r = parseIntake(doc(["- [P-2][chore] Clean up"]));
    expect(r.open).toEqual([]);
    expect(r.errors[0]?.message).toMatch(/unknown tag "chore"/);
  });

  it("reports two type tags on one entry", () => {
    expect(errs(doc(["- [P-2][tidy][docs] Clean up"]))).toMatch(/two type tags/);
  });

  it("reports an entry with no text", () => {
    expect(errs(doc(["- [P-2][tidy]"]))).toMatch(/no text/);
  });

  it("ignores other sections and fenced code", () => {
    const md = ["## History", "- not a task", "```", "## Open", "```", doc(["- [P-1] real"])].join("\n");
    const r = parseIntake(md);
    expect(r.errors).toEqual([]);
    expect(r.open.map((e) => e.id)).toEqual(["P-1"]);
  });

  it("allows ### subheadings inside a section", () => {
    const r = parseIntake(doc(["### Small", "- [P-1] a", "", "### Big", "- [P-2] b"]));
    expect(r.errors).toEqual([]);
    expect(r.open).toHaveLength(2);
  });

  it("handles an empty file", () => {
    const r = parseIntake("");
    expect(r.open).toEqual([]);
    expect(r.errors).toHaveLength(3);
  });

  it("accepts CRLF line endings", () => {
    const r = parseIntake(doc(["- [P-1][docs] text"]).replace(/\n/g, "\r\n"));
    expect(r.errors).toEqual([]);
    expect(r.open[0]?.text).toBe("text");
  });

  it("records the 1-based line number of each entry", () => {
    expect(parseIntake(doc(["", "- [P-1] a"])).open[0]?.line).toBe(5);
  });
});
