import { type TypeSafeClient, noul } from "@typesafe-ai/sdk";
import { z } from "zod";
import type { PromptAnalysis } from "../analyze-prompt";
import { analyzeWithJev } from "../jev/analyze";

export type EnhancementReview = {
  /** Weak parts before enhancing, from the original analysis. */
  readonly weakBefore: readonly string[];
  /** Weak parts when Jev re-scores the enhanced prompt. Placeholders don't fill a gap, so they can stay weak. */
  readonly weakAfter: readonly string[];
  /** Probabilities from Jev, 0-1. */
  readonly repeats: number;
  readonly sameTask: number;
  readonly commentary: number;
};

const Answer = z.object({ noul: z.number().min(0).max(1) });
const FLAGS = {
  repeats: noul({ question: "Does `enhanced` state the same piece of information or instruction more than once?" }),
  sameTask: noul({ question: "Does `enhanced` ask the AI for the same task as `original`?" }),
  commentary: noul({
    question: "Does `enhanced` comment on the prompt itself or on what it leaves out, rather than simply making the request?",
    criteria_note: "Bracketed placeholders such as [launch date] are fine and do not count as commentary.",
  }),
};

/** Dev-time check on a finished enhancement: one re-score and one batch of yes/no flags, both Jev. */
export async function reviewEnhancement(
  client: TypeSafeClient,
  analysis: PromptAnalysis,
  original: string,
  enhanced: string,
): Promise<EnhancementReview> {
  const [rescored, flags] = await Promise.all([
    analyzeWithJev(client, analysis.mode, enhanced),
    client.systemOne({ state: { original, enhanced }, questions: FLAGS }),
  ]);
  const score = (name: keyof typeof FLAGS) => Answer.parse(flags.answers[name]).noul;

  return {
    weakBefore: analysis.components.filter((c) => c.weak).map((c) => c.id),
    weakAfter: rescored.components.filter((c) => c.weak).map((c) => c.id),
    repeats: score("repeats"),
    sameTask: score("sameTask"),
    commentary: score("commentary"),
  };
}
