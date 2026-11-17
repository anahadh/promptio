import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { loadConfig } from "../config";
import { evaluateAutoMerge, gateStatus } from "./auto-merge";
import { countTests, ghJson, headSha, isStale, prForSha, toPrData } from "./github";
import { writeOutputs, writeSummary } from "./outputs";

/**
 * CLI: `--sha <head sha>` or `--pr <n>`. Runs on the base checkout (trusted code and config),
 * fetches the PR from the GitHub API, counts the base's tests, and evaluates the gate.
 * Writes allowed=true|false|skip, pr= and sha= to $GITHUB_OUTPUT. Exit 0 unless it crashed:
 * a blocked PR is a normal outcome, not a failure.
 */
function main(argv: string[]): number {
  const repo = process.env.GITHUB_REPOSITORY;
  if (!repo) throw new Error("GITHUB_REPOSITORY is not set");
  const flag = (name: string) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const sha = flag("sha");
  const pr = flag("pr") ? Number(flag("pr")) : sha ? prForSha(ghJson([`repos/${repo}/commits/${sha}/pulls`]), sha) : null;
  const skip = (why: string) => {
    console.log(JSON.stringify({ allowed: "skip", reason: why }));
    writeOutputs({ allowed: "skip", pr: pr ? String(pr) : "", sha: sha ?? "" });
    writeSummary(`Auto-merge gate skipped: ${why}`);
    return 0;
  };
  if (!pr) return skip(`no open PR has head ${sha}`);

  const pull = ghJson([`repos/${repo}/pulls/${pr}`]);
  if (sha && isStale(pull, sha)) return skip(`PR #${pr} has moved past ${sha}; a newer run will decide`);
  const head = headSha(pull);
  const files = ghJson(["--paginate", "--slurp", `repos/${repo}/pulls/${pr}/files?per_page=100`]);
  const checks = ghJson(["--paginate", "--slurp", `repos/${repo}/commits/${head}/check-runs?per_page=100`]);
  const testCount = countTests(JSON.parse(execFileSync("npx", ["vitest", "list", "--json"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })));

  const result = evaluateAutoMerge(toPrData(pull, files, checks, testCount), loadConfig());
  console.log(JSON.stringify({ pr, sha: head, ...result }, null, 2));
  const status = gateStatus(result);
  writeOutputs({ allowed: String(result.allowed), pr: String(pr), sha: head, state: status.state, description: status.description });
  writeSummary(
    result.allowed
      ? `PR #${pr} passes every auto-merge rule; enabling auto-merge for ${head}.`
      : `PR #${pr} stays open for review:\n${result.reasons.map((r) => `- ${r}`).join("\n")}`,
  );
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2)));
}
