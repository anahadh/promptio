import { type NoulQuestion, type ScoreQuestion, noul, score } from "@typesafe-ai/sdk";
import { type ComponentDef, type ModeDef, SPECIFICITY, type Specificity } from "../types";

/** What each level of the shared scale means (D25). Combined with each component's example via structure. */
export const LEVEL_MEANING: Readonly<Record<Specificity, string>> = {
  vague: "Not stated, only implied, or too vague to act on.",
  general: "Named, but general enough that many different answers would fit.",
  concrete: "Concrete enough to act on, but missing details that would remove guesswork.",
  precise: "Precise and checkable; nothing important is left to guess.",
};

/** Question names in the batched request. Ids are snake_case, so "__" can't collide. */
export const presentKey = (id: string) => `${id}__present`;
export const scoreKey = (id: string) => `${id}__score`;

/** Presence: the probability that the prompt's own words state this component (D19). */
export function presenceQuestion(c: ComponentDef): NoulQuestion {
  return noul(
    { question: c.present, component: c.id, applies_to: "the user's prompt (the whole state)" },
    {
      true: "The prompt's own words state this, even if vaguely.",
      false: "The prompt does not state this; at most it can be guessed from other details.",
    },
  );
}

/**
 * Specificity: Score over the shared 4-level scale. Each level is a structured object
 * (docs: "Advanced: structure") pairing the shared meaning with this component's example,
 * so levels describe situations rather than degrees.
 */
export function specificityQuestion(c: ComponentDef): ScoreQuestion {
  return score(
    {
      question: c.score,
      component: c.id,
      applies_to: "the user's prompt (the whole state)",
      if_absent: "If the prompt does not state this at all, choose the first level.",
    },
    SPECIFICITY.map((level, i) => ({ level, means: LEVEL_MEANING[level], example: c.examples[i] ?? "" })),
  );
}

/** All questions for a mode, batched into one Jev request (two per component). */
export function buildQuestions(mode: ModeDef): Record<string, NoulQuestion | ScoreQuestion> {
  const questions: Record<string, NoulQuestion | ScoreQuestion> = {};
  for (const c of mode.components) {
    questions[presentKey(c.id)] = presenceQuestion(c);
    questions[scoreKey(c.id)] = specificityQuestion(c);
  }
  return questions;
}
