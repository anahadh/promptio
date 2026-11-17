import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { proveFix, summarize, type TestRunner } from "./fail-before-pass-after";
import { writeOutputs, writeSummary } from "./outputs";

/** Runs the given test files with vitest in `dir` and reads its JSON report. */
export const vitestRunner: TestRunner = async (dir, files) => {
  const out = join(mkdtempSync(join(tmpdir(), "fbpa-out-")), "report.json");
  const bin = join(resolve(dir), "node_modules/.bin/vitest");
  spawnSync(bin, ["run", "--reporter=json", `--outputFile=${out}`, ...files], { cwd: dir, encoding: "utf8" });
  if (!existsSync(out)) return { ran: 0, failed: 0, collectionErrors: files.length };
  return summarize(JSON.parse(readFileSync(out, "utf8")));
};

function arg(argv: string[], name: string): string {
  const i = argv.indexOf(`--${name}`);
  const value = i >= 0 ? argv[i + 1] : undefined;
  if (!value) throw new Error(`missing --${name}`);
  return value;
}

/**
 * CLI: --base <dir> --head <dir> --files <path>. The files list holds the PR's
 * changed paths, one per line, without deletions (git diff --diff-filter=d).
 * Writes proven= and label=; exit 1 when unproven so the check shows red.
 */
async function main(argv: string[]): Promise<number> {
  const paths = readFileSync(arg(argv, "files"), "utf8").split("\n").map((l) => l.trim()).filter(Boolean);
  const proof = await proveFix({
    files: paths.map((path) => ({ path, previousPath: null, status: "modified" })),
    baseDir: arg(argv, "base"),
    headDir: arg(argv, "head"),
    run: vitestRunner,
  });
  console.log(JSON.stringify(proof, null, 2));
  writeOutputs({ proven: String(proof.proven), label: proof.label ?? "" });
  writeSummary(proof.proven ? "Fix proven: the new tests fail on base and pass on this PR." : `Unproven fix:\n${proof.reasons.map((r) => `- ${r}`).join("\n")}`);
  return proof.proven ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (e) => (console.error(e), process.exit(2)));
}
