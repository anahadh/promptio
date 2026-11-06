import type { AnalyzedComponent } from "../analyze-prompt";
import { SHARED_COMPONENTS, getMode } from "../modes";
import type { ComponentDef, ModeId } from "../types";

/**
 * - polish: already strong; tidy for LLMs, keeping every fact.
 * - improve: vague; make it specific using only facts in the prompt.
 * - infer: missing, with a safe default; Haiku writes it.
 * - placeholder: missing, and only the user knows; labelled gap, no AI.
 * - verbatim: pasted code or long material; copied exactly, no AI.
 * - fixed: the mode's always-on constraints, no AI.
 */
export type PartAction = "polish" | "improve" | "infer" | "placeholder" | "verbatim" | "fixed";

export type PlannedPart = {
  readonly id: string;
  /** Index into the mode's layout: 0 role, 1 situation and goal, 2 how to respond. */
  readonly paragraph: number;
  readonly action: PartAction;
  /** The prompt text this part alone owns, in prompt order. */
  readonly excerpts: readonly string[];
  /** Final text for actions that need no AI; null when Haiku generates it. */
  readonly staticText: string | null;
  /** Null only for the synthetic fixed-constraints part. */
  readonly def: ComponentDef | null;
};

export type EnhancementPlan = {
  readonly mode: ModeId;
  readonly parts: readonly PlannedPart[];
  /** Components that produce nothing, with the reason. */
  readonly omitted: readonly { readonly id: string; readonly reason: "skipped" | "vague_no_text" | "covered" }[];
};

/** Longer excerpts, and anything with a code fence, are never sent through a rewrite. */
export const VERBATIM_MIN_CHARS = 500;

const FILLER_WORDS = new Set([
  "and", "but", "so", "or", "then", "also", "plus", "please", "the", "a", "an", "it", "to", "for", "in", "on", "at", "of", "with",
]);

type Range = readonly [start: number, end: number];

/** True when text carries no information of its own, like a stray "and". */
export function isFiller(text: string): boolean {
  const words = text.toLowerCase().match(/[\p{L}\p{N}$%]+/gu);
  return !words || words.every((word) => FILLER_WORDS.has(word));
}

/** The parts of `range` not covered by `claimed`. `claimed` must be sorted and non-overlapping. */
function subtract(range: Range, claimed: readonly Range[]): Range[] {
  const pieces: Range[] = [];
  let cursor = range[0];
  for (const [start, end] of claimed) {
    if (end <= cursor) continue;
    if (start >= range[1]) break;
    if (start > cursor) pieces.push([cursor, start]);
    cursor = Math.max(cursor, end);
  }
  if (cursor < range[1]) pieces.push([cursor, range[1]]);
  return pieces;
}

function mergeRanges(ranges: readonly Range[]): Range[] {
  const merged: [number, number][] = [];
  for (const [start, end] of [...ranges].sort((a, b) => a[0] - b[0])) {
    const last = merged.at(-1);
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  return merged;
}

/** Trim separators off a cut piece of the prompt. Returns null when nothing meaningful is left. */
function cleanPiece(prompt: string, [start, end]: Range): { start: number; text: string } | null {
  const text = prompt.slice(start, end).replace(/^[\s,;:]+|[\s,;:]+$/g, "");
  return text && !isFiller(text) ? { start, text } : null;
}

/** A scrap left over after cutting a span, like "write" or "give me": too little to rewrite. Numbers always count. */
function isScrap(text: string): boolean {
  return !/\d/.test(text) && text.trim().split(/\s+/).length < 3;
}

/**
 * Give every excerpt exactly one owner, which is what prevents duplicates. On overlap,
 * `goal` wins so the request stays a whole sentence, then mode-specific parts, then
 * shared ones in layout order. Scraps left by a cut are dropped. Text nobody claimed
 * goes to `context`, so nothing the user wrote is lost.
 */
export function assignOwnership(
  modeId: ModeId,
  prompt: string,
  components: readonly AnalyzedComponent[],
): ReadonlyMap<string, readonly string[]> {
  const shared = new Set<string>(SHARED_COMPONENTS.map((c) => c.id));
  const order = getMode(modeId).layout.flat();
  const priority = [
    "goal",
    ...order.filter((id) => !shared.has(id)),
    ...order.filter((id) => shared.has(id) && id !== "goal"),
  ];
  const byId = new Map(components.map((c) => [c.id, c]));

  const owned = new Map<string, { start: number; text: string }[]>();
  let claimed: Range[] = [];
  for (const id of priority) {
    const pieces: { start: number; text: string }[] = [];
    for (const span of byId.get(id)?.spans ?? []) {
      for (const range of subtract([span.start, span.end], claimed)) {
        const piece = cleanPiece(prompt, range);
        const wasCut = range[0] !== span.start || range[1] !== span.end;
        if (piece && !(wasCut && isScrap(piece.text))) pieces.push(piece);
      }
      claimed = mergeRanges([...claimed, [span.start, span.end]]);
    }
    owned.set(id, pieces);
  }

  const leftovers = subtract([0, prompt.length], claimed).flatMap((range) => cleanPiece(prompt, range) ?? []);
  owned.set("context", [...(owned.get("context") ?? []), ...leftovers]);

  return new Map(
    [...owned].map(([id, pieces]) => [id, pieces.sort((a, b) => a.start - b.start).map((p) => p.text)] as const),
  );
}

/** "key_points" -> "Key points". */
export function labelOf(id: string): string {
  const words = id.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Sort every component into one action. Pure: no AI involved. */
export function planEnhancement(
  modeId: ModeId,
  prompt: string,
  components: readonly AnalyzedComponent[],
): EnhancementPlan {
  const mode = getMode(modeId);
  const byId = new Map(components.map((c) => [c.id, c]));
  const ownership = assignOwnership(modeId, prompt, components);
  const parts: PlannedPart[] = [];
  const omitted: { id: string; reason: "skipped" | "vague_no_text" | "covered" }[] = [];

  mode.layout.forEach((ids, paragraph) => {
    for (const id of ids) {
      const def = mode.components.find((c) => c.id === id);
      const component = byId.get(id);
      if (!def || !component) throw new Error(`Component "${id}" is missing from mode "${modeId}".`);
      const excerpts = ownership.get(id) ?? [];
      const base = { id, paragraph, excerpts, def };

      if (excerpts.length) {
        if (excerpts.some((e) => e.length >= VERBATIM_MIN_CHARS || e.includes("```"))) {
          parts.push({ ...base, action: "verbatim", staticText: excerpts.join("\n") });
        } else {
          parts.push({ ...base, action: component.status === "ok" ? "polish" : "improve", staticText: null });
        }
      } else if (component.status === "missing") {
        if (def.ifMissing === "infer") parts.push({ ...base, action: "infer", staticText: null });
        else parts.push({ ...base, action: "placeholder", staticText: `${labelOf(id)}: [${def.ask ?? "please add this"}]` });
      } else if (component.status === "vague") {
        omitted.push({ id, reason: "vague_no_text" });
      } else {
        omitted.push({ id, reason: component.status === "skipped" ? "skipped" : "covered" });
      }
    }
  });

  const fixed = mode.fixedConstraints.filter((line) => !prompt.includes(line));
  if (fixed.length) {
    parts.push({
      id: "fixed_constraints",
      paragraph: mode.layout.length - 1,
      action: "fixed",
      excerpts: [],
      staticText: fixed.join(" "),
      def: null,
    });
  }

  return { mode: modeId, parts, omitted };
}
