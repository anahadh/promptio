import { pathToFileURL } from "node:url";
import { isTaskType } from "../types";
import { writeOutputs, writeSummary } from "./outputs";

/** Checks a bot PR body against the section 10a template. */

export const SECTIONS = ["Goal", "Done when", "What changed", "How it was checked"];
const LIST_SECTIONS = new Set(["Done when", "What changed", "How it was checked"]);
const FOOTER = /^Task:\s*(\S+)\s*·\s*Type:\s*(\S+)\s*·\s*Decisions:\s*(.+)$/;
const DECISIONS = /^(none|D\d+(\s*,\s*D\d+)*)$/;
/** A line that is only template placeholder(s), e.g. "- <file>: <what and why>". */
const PLACEHOLDER = /^(-\s*)?(<[^>]*>[\s:,.]*)+$/;

export function checkPrBody(body: string): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  const lines = body.split(/\r?\n/);
  const found: { name: string; content: string[] }[] = [];
  let footer: string | null = null;

  for (const line of lines) {
    const heading = /^##\s+(.+?)\s*$/.exec(line);
    if (heading) found.push({ name: heading[1]!, content: [] });
    else if (FOOTER.test(line.trim()) || /^Task:/.test(line.trim())) footer = line.trim();
    else found.at(-1)?.content.push(line);
  }

  for (const s of found) {
    if (!SECTIONS.includes(s.name)) failures.push(`unexpected section "## ${s.name}"`);
  }
  for (const name of SECTIONS) {
    const matches = found.filter((s) => s.name === name);
    if (matches.length === 0) failures.push(`missing section "## ${name}"`);
    if (matches.length > 1) failures.push(`section "## ${name}" appears more than once`);
    const s = matches[0];
    if (!s) continue;
    const real = s.content.map((l) => l.trim()).filter((l) => l && !PLACEHOLDER.test(l));
    if (real.length === 0) failures.push(`section "## ${name}" is empty`);
    else if (LIST_SECTIONS.has(name) && !real.some((l) => l.startsWith("- "))) {
      failures.push(`section "## ${name}" needs at least one "- " bullet`);
    }
  }
  const order = found.map((s) => s.name).filter((n) => SECTIONS.includes(n));
  const expected = SECTIONS.filter((n) => order.includes(n));
  if ([...new Set(order)].join("|") !== expected.join("|")) failures.push(`sections are out of order; expected ${SECTIONS.join(", ")}`);

  failures.push(...footerFailures(footer));
  return { ok: failures.length === 0, failures };
}

function footerFailures(footer: string | null): string[] {
  const m = footer ? FOOTER.exec(footer) : null;
  if (!m) return ['missing footer "Task: <id> · Type: <type> · Decisions: <D-IDs or none>"'];
  const [, id = "", type = "", decisions = ""] = m;
  const out: string[] = [];
  if (!/^[A-Z]+-\d+$/.test(id)) out.push(`footer task id "${id}" is not like P-14`);
  if (!isTaskType(type)) out.push(`footer type "${type}" is not a task type`);
  if (!DECISIONS.test(decisions.trim())) out.push(`footer decisions "${decisions.trim()}" must be D-IDs or "none"`);
  return out;
}

/** CLI: reads the body from $PR_BODY. Exit 1 when the format fails. */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const r = checkPrBody(process.env.PR_BODY ?? "");
  console.log(JSON.stringify(r, null, 2));
  writeOutputs({ ok: String(r.ok) });
  writeSummary(r.ok ? "PR body matches the template." : `PR body problems:\n${r.failures.map((f) => `- ${f}`).join("\n")}`);
  process.exit(r.ok ? 0 : 1);
}
