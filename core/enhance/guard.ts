import type { PlannedPart } from "./plan";

const numbersIn = (text: string): string[] =>
  (text.replace(/\[[^\]]*\]/g, " ").match(/\d[\d,.]*\d|\d/g) ?? []).map((n) => n.replace(/,/g, ""));

/** Numbers in `rewrite` that the original prompt doesn't contain. `[placeholder]` text is ignored. */
export function newNumbers(prompt: string, rewrite: string): string[] {
  const known = new Set(numbersIn(prompt));
  return [...new Set(numbersIn(rewrite))].filter((n) => !known.has(n));
}

const PROCESS_TALK = /\b(the text I own|this part|owned by|other (parts|writers)|the prompt (does|doesn't|did|asks|says|leaves|states)|left open)\b/i;

/** Haiku talking about its own task or the prompt, instead of writing the request. Never belongs in the output. */
export function leaksProcess(rewrite: string): boolean {
  return PROCESS_TALK.test(rewrite);
}

export type GuardVerdict =
  | { readonly outcome: "pass" }
  | { readonly outcome: "warn" | "reject"; readonly numbers: readonly string[] };

/**
 * A new number can't be a fact from the user. Polished text and `ask` parts must add none,
 * so those rewrites are rejected. `infer` parts may hold harmless defaults like
 * "3 practice problems", so those only warn. Catches numbers only, not invented names or claims.
 */
export function checkNumbers(part: PlannedPart, prompt: string, rewrite: string): GuardVerdict {
  const numbers = newNumbers(prompt, rewrite);
  if (!numbers.length) return { outcome: "pass" };
  const strict = part.action === "polish" || part.def?.ifMissing === "ask";
  return { outcome: strict ? "reject" : "warn", numbers };
}
