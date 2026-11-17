import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseIntake } from "./intake";

const doc = (open: string[] = []) => ["## Open", ...open, "## Needs triage", "## Done", ""].join("\n");

describe("intake cli", () => {
  const script = resolve("harness/intake.ts");
  const run = (args: string[], cwd = process.cwd()) => {
    try {
      return { code: 0, out: execFileSync(resolve("node_modules/.bin/tsx"), [script, ...args], { cwd, encoding: "utf8", stdio: "pipe" }) };
    } catch (e) {
      const err = e as { status: number; stdout: string };
      return { code: err.status, out: err.stdout };
    }
  };
  const tmp = () => mkdtempSync(join(tmpdir(), "intake-"));

  it("cli prints JSON and exits 0 for a clean file", () => {
    const path = join(tmp(), "p.md");
    writeFileSync(path, doc(["- [P-1][docs] a"]));
    const { code, out } = run([path]);
    expect(code).toBe(0);
    expect(JSON.parse(out).open[0].id).toBe("P-1");
  });

  it("cli exits 1 when the file has errors", () => {
    const path = join(tmp(), "p.md");
    writeFileSync(path, "## Open\n- broken\n");
    const { code, out } = run([path]);
    expect(code).toBe(1);
    expect(JSON.parse(out).errors.length).toBeGreaterThan(0);
  });

  it("cli exits 2 for a missing file", () => {
    expect(run([join(tmp(), "nope.md")]).code).toBe(2);
  });

  it("cli defaults to the config intake path", () => {
    const dir = tmp();
    writeFileSync(join(dir, "harness.config.yaml"), readFileSync("harness.config.yaml", "utf8").replace("intake: docs/problems.md", "intake: q.md"));
    writeFileSync(join(dir, "q.md"), doc(["- [P-7] from default"]));
    const { code, out } = run([], dir);
    expect(code).toBe(0);
    expect(JSON.parse(out).open[0].id).toBe("P-7");
  });

  it.skipIf(!existsSync("docs/problems.md"))("the private problems.md parses with no errors", () => {
    expect(parseIntake(readFileSync("docs/problems.md", "utf8")).errors).toEqual([]);
  });
});
