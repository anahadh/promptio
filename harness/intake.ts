import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { isTaskType, type TaskType } from "./types";

/** Parser for the intake queue (`problems.md`, agent-loop spec section 5). Read-only. */

export type Section = "open" | "needs_triage" | "done";
export interface IntakeEntry {
  id: string;
  type: TaskType | null;
  text: string;
  section: Section;
  /** PR number from a `[from-review PR #n]` tag. */
  fromReviewPr: number | null;
  /** The PR that closed this task (Done entries). */
  pr: number | null;
  prUrl: string | null;
  line: number;
}
export interface IntakeError { line: number; message: string }
export interface Intake { open: IntakeEntry[]; needsTriage: IntakeEntry[]; done: IntakeEntry[]; errors: IntakeError[] }

const HEADINGS: Record<string, Section> = { "## Open": "open", "## Needs triage": "needs_triage", "## Done": "done" };
const ENTRY = /^- \[([A-Z]+-\d+)\]((?:\[[^\]]*\])*)(.*)$/;
const FROM_REVIEW = /^from-review PR #(\d+)$/;
const PR_URL = /https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/(\d+)/;
const PR_REF = /\bPR #(\d+)\b/;

export function parseIntake(markdown: string): Intake {
  const out: Intake = { open: [], needsTriage: [], done: [], errors: [] };
  const lists: Record<Section, IntakeEntry[]> = { open: out.open, needs_triage: out.needsTriage, done: out.done };
  const err = (line: number, message: string) => out.errors.push({ line, message });
  const seenHeadings = new Set<string>();
  const seenIds = new Map<string, number>();
  let section: Section | null = null;
  let inFence = false;

  markdown.split(/\r?\n/).forEach((raw, i) => {
    const line = i + 1;
    const text = raw.trimEnd();
    if (text.trimStart().startsWith("```")) inFence = !inFence;
    if (inFence || text.trimStart().startsWith("```")) return;

    if (/^#{1,2} /.test(text)) {
      section = HEADINGS[text] ?? null;
      if (section) {
        if (seenHeadings.has(text)) err(line, `"${text}" appears twice`);
        seenHeadings.add(text);
      }
      return;
    }
    if (!section || text.trim() === "" || text.startsWith("###")) return;
    if (!text.startsWith("- ")) return err(line, "entries must be one line; continuation text is not allowed");

    const entry = parseEntry(text, section, line);
    if (typeof entry === "string") return err(line, entry);
    const first = seenIds.get(entry.id);
    if (first !== undefined) return err(line, `${entry.id} is a duplicate of line ${first}`);
    seenIds.set(entry.id, line);
    if (section === "done" && entry.pr === null) err(line, `${entry.id} is in Done without a PR link`);
    lists[section].push(entry);
  });

  for (const heading of Object.keys(HEADINGS)) {
    if (!seenHeadings.has(heading)) err(0, `missing section "${heading}"`);
  }
  return out;
}

/** Returns the entry, or an error message. */
function parseEntry(line: string, section: Section, lineNo: number): IntakeEntry | string {
  const m = ENTRY.exec(line);
  if (!m) return `malformed entry; expected "- [ID][type] text": ${line}`;
  const [, id = "", tagBlock = "", rest = ""] = m;
  let type: TaskType | null = null;
  let fromReviewPr: number | null = null;
  for (const [, tag = ""] of tagBlock.matchAll(/\[([^\]]*)\]/g)) {
    const review = FROM_REVIEW.exec(tag);
    if (review) fromReviewPr = Number(review[1]);
    else if (!isTaskType(tag)) return `${id} has unknown tag "${tag}"`;
    else if (type) return `${id} has two type tags`;
    else type = tag;
  }
  const text = rest.trim();
  if (!text) return `${id} has no text`;
  const url = PR_URL.exec(text);
  const ref = url ?? PR_REF.exec(text);
  return {
    id, type, text, section, fromReviewPr,
    pr: ref ? Number(ref[1]) : null,
    prUrl: url ? url[0] : null,
    line: lineNo,
  };
}

/** CLI: `npx tsx harness/intake.ts [path]`. Prints JSON; exit 1 on parse errors, 2 if unreadable. */
async function main(argv: string[]): Promise<number> {
  let path = argv[0];
  let markdown: string;
  try {
    if (!path) path = (await import("./config")).loadConfig().intake;
    markdown = readFileSync(path, "utf8");
  } catch (e) {
    console.error(`intake: ${(e as Error).message}`);
    return 2;
  }
  const intake = parseIntake(markdown);
  console.log(JSON.stringify(intake, null, 2));
  return intake.errors.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
