import { describe, expect, it } from "vitest";
import { checkPrBody } from "./pr-format";

const FOOTER = "Task: P-14 · Type: bugfix · Decisions: D22";
const parts = {
  Goal: "Emoji spans are dropped; this makes the decomposer keep them.",
  "Done when": "- Spans with emoji get correct offsets",
  "What changed": "- core/decompose/locate.ts: count code points",
  "How it was checked": "- npm test; the new test failed before the fix",
};
const body = (p: Record<string, string> = parts, footer = FOOTER) =>
  [...Object.entries(p).map(([h, t]) => `## ${h}\n${t}\n`), footer].join("\n");
const failures = (b: string) => checkPrBody(b).failures.join("\n");

describe("checkPrBody", () => {
  it("accepts the section 10a template filled in", () => {
    expect(checkPrBody(body())).toEqual({ ok: true, failures: [] });
  });

  it.each(Object.keys(parts))("names each missing section: %s", (name) => {
    const p: Record<string, string> = { ...parts };
    delete p[name];
    expect(failures(body(p))).toContain(`missing section "## ${name}"`);
  });

  it("names an empty section", () => {
    expect(failures(body({ ...parts, Goal: "   " }))).toContain(`section "## Goal" is empty`);
  });

  it("treats a section with only <placeholder> text as empty", () => {
    const r = failures(body({ ...parts, "What changed": "- <file>: <what and why>" }));
    expect(r).toContain(`section "## What changed" is empty`);
  });

  it("rejects sections out of order", () => {
    const { Goal, ...rest } = parts;
    expect(failures(body({ ...rest, Goal }))).toMatch(/out of order/);
  });

  it("rejects a duplicated section", () => {
    expect(failures(body() .replace("## Done when", "## Goal\nagain\n\n## Done when"))).toContain(`section "## Goal" appears more than once`);
  });

  it("rejects an extra ## section", () => {
    expect(failures(body({ ...parts, Notes: "extra" }))).toContain(`unexpected section "## Notes"`);
  });

  it("requires a bullet in each list section", () => {
    const r = failures(body({ ...parts, "Done when": "it works", "How it was checked": "ran tests" }));
    expect(r).toContain(`section "## Done when" needs at least one "- " bullet`);
    expect(r).toContain(`section "## How it was checked" needs at least one "- " bullet`);
    expect(r).not.toContain(`"## Goal" needs`);
  });

  it("rejects a missing footer", () => {
    expect(failures(body(parts, ""))).toMatch(/missing footer/);
  });

  it("rejects a footer with an unknown type", () => {
    expect(failures(body(parts, "Task: P-14 · Type: chore · Decisions: none"))).toMatch(/footer type "chore"/);
  });

  it("rejects a footer with a malformed task id", () => {
    expect(failures(body(parts, "Task: fourteen · Type: docs · Decisions: none"))).toMatch(/footer task id "fourteen"/);
  });

  it("accepts Decisions: none and a D-ID list", () => {
    expect(checkPrBody(body(parts, "Task: P-1 · Type: docs · Decisions: none")).ok).toBe(true);
    expect(checkPrBody(body(parts, "Task: R-3 · Type: tidy · Decisions: D22, D30")).ok).toBe(true);
    expect(failures(body(parts, "Task: P-1 · Type: docs · Decisions: see plan"))).toMatch(/footer decisions/);
  });

  it("accepts CRLF bodies", () => {
    expect(checkPrBody(body().replace(/\n/g, "\r\n")).ok).toBe(true);
  });

  it("reports all failures at once", () => {
    const r = checkPrBody("## Goal\n\n## Notes\nx\n");
    expect(r.ok).toBe(false);
    expect(r.failures.length).toBeGreaterThanOrEqual(5);
  });
});
