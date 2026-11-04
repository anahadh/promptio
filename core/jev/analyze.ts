import type { TypeSafeClient } from "@typesafe-ai/sdk";
import { z } from "zod";
import { getMode } from "../modes";
import { type ModeId, SPECIFICITY, type Specificity } from "../types";
import { buildQuestions, presentKey, scoreKey } from "./questions";
import { type Judgment, judge, levelOf, normalizeScore } from "./weak";

/** Kept as "latest" by choice; pin when thresholds are calibrated (D15, D29). The resolved version is logged per response. */
export const JEV_MODEL = "jev-latest";

export type JevComponent = Judgment & {
  readonly id: string;
  /** Noul probability that the prompt states this component. */
  readonly present: number;
  readonly specificity: {
    /** Normalized 0-1 (raw / 3). */
    readonly score: number;
    /** Jev's expected level index, 0-3. */
    readonly raw: number;
    readonly level: Specificity;
    readonly confidence: number;
    /** Jev's probability for each level, in SPECIFICITY order. */
    readonly probabilities: readonly number[];
  };
};

export type JevAnalysis = {
  readonly mode: ModeId;
  /** The model version Jev actually ran, e.g. "jev-1.14.0". */
  readonly model: string;
  readonly components: readonly JevComponent[];
  readonly usage: { readonly inputTokens: number | null };
  /** Jev's answers as returned, keyed by question name. For debugging and the viewer. */
  readonly raw: Readonly<Record<string, unknown>>;
};

// Network data is validated at the edge, even though the SDK types it. Zod 4 numbers are finite by default.
const NoulAnswer = z.object({ noul: z.number().min(0).max(1) });
const ScoreAnswer = z.object({
  score: z.number().min(0).max(SPECIFICITY.length - 1 + 1e-6), // tolerance for float noise
  confidence: z.number(),
  probabilities: z.record(z.string(), z.number()).optional(),
});

function parseAnswer<T extends z.ZodType>(schema: T, answers: Record<string, unknown>, name: string): z.infer<T> {
  const result = schema.safeParse(answers[name]);
  if (!result.success) throw new Error(`Jev answer "${name}" is malformed: ${z.prettifyError(result.error)}`);
  return result.data;
}

/**
 * Score every component of a mode in one batched Jev request. Jev reads the whole
 * prompt, so this runs in parallel with the decomposer rather than after it (D29).
 */
export async function analyzeWithJev(client: TypeSafeClient, modeId: ModeId, prompt: string): Promise<JevAnalysis> {
  const mode = getMode(modeId);
  const response = await client.systemOne({ model: JEV_MODEL, state: prompt, questions: buildQuestions(mode) });

  const components = mode.components.map((def): JevComponent => {
    const presence = parseAnswer(NoulAnswer, response.answers, presentKey(def.id));
    const spec = parseAnswer(ScoreAnswer, response.answers, scoreKey(def.id));
    const normalized = normalizeScore(spec.score);
    return {
      id: def.id,
      present: presence.noul,
      specificity: {
        score: normalized,
        raw: spec.score,
        level: levelOf(spec.score),
        confidence: spec.confidence,
        probabilities: SPECIFICITY.map((_, i) => spec.probabilities?.[String(i)] ?? 0),
      },
      // Judged without spans here; analyzePrompt re-judges once the decomposer's spans are known.
      ...judge(def, presence.noul, normalized),
    };
  });

  return {
    mode: modeId,
    model: response.model,
    components,
    usage: { inputTokens: response.usage.input_tokens },
    raw: response.answers,
  };
}
