import { type ComponentDef, SPECIFICITY, type Specificity } from "../types";

/**
 * Starting thresholds. Placeholders until calibration from downstream gain (D15).
 * Presence cutoffs follow TypeSafe's suggested Noul starting points (0.7 yes / 0.3 no).
 */
export const THRESHOLDS = {
  presentYes: 0.7,
  presentNo: 0.3,
  /** Normalized specificity (0-1) below which a stated component is weak. */
  weakBelow: 0.5,
} as const;

export type Presence = "present" | "absent" | "unsure";

/**
 * - ok: stated and specific enough; left verbatim (D7).
 * - vague: stated but below the specificity threshold; rewritten.
 * - missing: required and not stated; filled per ifMissing (D22).
 * - skipped: optional and not stated; never injected (D16).
 */
export type Status = "ok" | "vague" | "missing" | "skipped";

export type Judgment = {
  readonly presence: Presence;
  readonly status: Status;
  readonly weak: boolean;
};

export function presenceOf(probability: number): Presence {
  if (probability >= THRESHOLDS.presentYes) return "present";
  if (probability <= THRESHOLDS.presentNo) return "absent";
  return "unsure";
}

/** Jev's Score is the expected level index (0..levels-1); normalize to 0-1. */
export function normalizeScore(raw: number, levels = SPECIFICITY.length): number {
  return Math.min(1, Math.max(0, raw / (levels - 1)));
}

/** Most likely level for display, from the expected index. */
export function levelOf(raw: number): Specificity {
  const index = Math.min(SPECIFICITY.length - 1, Math.max(0, Math.round(raw)));
  return SPECIFICITY[index]!;
}

/**
 * Combine presence and specificity into one decision.
 *
 * `hasSpan` is whether the decomposer found text for this component. It resolves
 * disagreements in the safe direction:
 * - Jev says absent but a span exists: treat as unsure, so we never ask the user for
 *   something they already wrote.
 * - Optional and unsure with no span: skipped, so optional parts (e.g. role, D17) are
 *   never written in on a coin flip.
 * Required and unsure is judged by specificity: it can be rewritten, but never "missing".
 */
export function judge(def: ComponentDef, presentProbability: number, normalizedScore: number, hasSpan = false): Judgment {
  let presence = presenceOf(presentProbability);
  if (presence === "absent" && hasSpan) presence = "unsure";

  let status: Status;
  if (presence === "absent") status = def.required ? "missing" : "skipped";
  else if (presence === "unsure" && !def.required && !hasSpan) status = "skipped";
  else status = normalizedScore < THRESHOLDS.weakBelow ? "vague" : "ok";

  return { presence, status, weak: status === "vague" || status === "missing" };
}
