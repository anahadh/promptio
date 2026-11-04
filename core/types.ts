/**
 * Mode data model (docs: task-types.md). Mode files are authored by us and bundled,
 * so they are checked at compile time with `satisfies ModeDef`, plus rule tests in
 * modes.test.ts. Runtime validation (Zod) is reserved for network data from Jev/Haiku.
 */

/** v1 modes (D20). The mode comes from the user's click, never auto-detected (D18). */
export const MODE_IDS = ["writing", "coding", "research", "learning", "analysis", "ideas"] as const;
export type ModeId = (typeof MODE_IDS)[number];

/**
 * What to do when a part is weak or missing (D22, D26). Fixed per component because it
 * encodes who *could* know the answer, which a model must not decide (it would invent facts).
 * Runtime still checks the prompt and chat history first in both cases.
 * - infer: a sensible default exists; Haiku writes it.
 * - ask: only the user knows it; ask inline, or insert a [placeholder] if skipped.
 */
export type IfMissing = "infer" | "ask";

/** Shared specificity scale (D25). A runtime result is one of these values. */
export const SPECIFICITY = ["vague", "general", "concrete", "precise"] as const;
export type Specificity = (typeof SPECIFICITY)[number];

/**
 * One short example per SPECIFICITY level, in order, for this component.
 * Fed to Jev Score as anchors; the "precise" example is also Haiku's rewrite target.
 */
export type Examples = readonly [vague: string, general: string, concrete: string, precise: string];

export type ComponentDef = {
  /** Component type, e.g. "goal". Unique within a mode. */
  readonly id: string;
  /** Absent + required => weak. Absent + optional => skipped, never injected (D16). */
  readonly required: boolean;
  readonly ifMissing: IfMissing;
  /** Presence question, "Does the prompt state ...?" (sent to Jev as a Noul question, D19). */
  readonly present: string;
  /** Specificity question, "How specific is ...?" (sent to Jev as a Score question). */
  readonly score: string;
  readonly examples: Examples;
};

/**
 * Output rubric criterion. Dev-time eval only (D14).
 * Must be judgeable from the prompt and output alone (D24).
 * judge "exec" means checked by running tests, not by Jev (coding correctness).
 */
export type Criterion = {
  readonly id: string;
  readonly question: string;
  readonly judge: "jev" | "exec";
};

export type ModeDef = {
  readonly id: ModeId;
  readonly label: string;
  /** Shared components first, then mode-specific ones. */
  readonly components: readonly ComponentDef[];
  /**
   * Constraints always appended to the enhanced prompt in this mode (e.g. writing anti-slop).
   * TODO: these are first drafts and too thin; expand them for every mode later.
   */
  readonly fixedConstraints: readonly string[];
  readonly rubric: readonly [Criterion, Criterion, Criterion, Criterion];
};
