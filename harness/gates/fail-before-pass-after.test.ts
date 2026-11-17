import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { proveFix, summarize, type RunSummary, type TestRunner } from "./fail-before-pass-after";
import { vitestRunner } from "./fbpa-cli";
import { file } from "./fixtures";

const FAIL: RunSummary = { ran: 2, failed: 1, collectionErrors: 0 };
const PASS: RunSummary = { ran: 2, failed: 0, collectionErrors: 0 };
const fake = (base: RunSummary, head: RunSummary): TestRunner => async (dir) => (dir === "base" ? base : head);
const prove = (base: RunSummary, head: RunSummary, files = [file("core/x.ts"), file("core/x.test.ts")]) =>
  proveFix({ files, baseDir: "base", headDir: "head", run: fake(base, head), copy: () => {} });

describe("proveFix", () => {
  it("proven when tests fail on base and pass on head", async () => {
    expect(await prove(FAIL, PASS)).toEqual({ proven: true, reasons: [], label: null });
  });
  it("unproven when tests pass on base", async () => {
    expect(await prove(PASS, PASS)).toMatchObject({ proven: false, label: "unproven-fix", reasons: [expect.stringMatching(/did not fail on the base/)] });
  });
  it("unproven when tests fail on head", async () => {
    expect(await prove(FAIL, FAIL)).toMatchObject({ proven: false, label: "unproven-fix", reasons: [expect.stringMatching(/fail on the PR branch/)] });
  });
  it("unproven when base fails only by collection error", async () => {
    const r = await prove({ ran: 0, failed: 0, collectionErrors: 1 }, PASS);
    expect(r.proven).toBe(false);
    expect(r.reasons.join()).toMatch(/collection error/);
  });
  it("unproven when head ran no tests", async () => {
    expect((await prove(FAIL, { ran: 0, failed: 0, collectionErrors: 0 })).reasons.join()).toMatch(/no tests ran on the PR branch/);
  });
  it("unproven when no test file changed", async () => {
    expect(await prove(FAIL, PASS, [file("core/x.ts")])).toMatchObject({ proven: false, label: "unproven-fix", reasons: [expect.stringMatching(/no test file/)] });
  });
  it("ignores removed test files", async () => {
    expect((await prove(FAIL, PASS, [file("core/x.ts"), file("core/old.test.ts", "removed")])).proven).toBe(false);
  });
  it("copies each changed test file into base before running", async () => {
    const log: string[] = [];
    await proveFix({
      files: [file("a.test.ts"), file("b/c.test.ts", "added"), file("d.ts")],
      baseDir: "base",
      headDir: "head",
      copy: (from, to) => log.push(`copy ${from} ${to}`),
      run: async (dir, files) => (log.push(`run ${dir} ${files.join(",")}`), dir === "base" ? FAIL : PASS),
    });
    expect(log).toEqual(["copy head/a.test.ts base/a.test.ts", "copy head/b/c.test.ts base/b/c.test.ts", "run base a.test.ts,b/c.test.ts", "run head a.test.ts,b/c.test.ts"]);
  });
  it("summarize reads vitest JSON and rejects bad JSON", () => {
    const json = { numPassedTests: 1, numFailedTests: 1, testResults: [{ status: "failed", assertionResults: [] }, { status: "failed", assertionResults: [{}, {}] }] };
    expect(summarize(json)).toEqual({ ran: 2, failed: 1, collectionErrors: 1 });
    expect(() => summarize({ nope: 1 })).toThrow();
  });
});

describe("vitestRunner", () => {
  const project = (impl: string) => {
    const dir = mkdtempSync(join(tmpdir(), "fbpa-"));
    symlinkSync(resolve("node_modules"), join(dir, "node_modules"));
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "src/sum.ts"), `export const sum = (a: number, b: number) => ${impl};\n`);
    return dir;
  };
  it("real vitest runner: fails on a buggy base and passes on the fixed head", async () => {
    const base = project("a - b");
    const head = project("a + b");
    writeFileSync(join(head, "src/sum.test.ts"), `import { expect, it } from "vitest";\nimport { sum } from "./sum";\nit("adds", () => expect(sum(2, 2)).toBe(4));\n`);
    const r = await proveFix({ files: [file("src/sum.ts"), file("src/sum.test.ts", "added")], baseDir: base, headDir: head, run: vitestRunner });
    expect(r).toEqual({ proven: true, reasons: [], label: null });
  }, 60_000);
});
