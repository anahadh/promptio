import type Anthropic from "@anthropic-ai/sdk";
import type { TypeSafeClient } from "@typesafe-ai/sdk";
import { type DecomposedComponent, type Decomposition, decompose } from "./decompose/decompose";
import { type JevAnalysis, type JevComponent, analyzeWithJev } from "./jev/analyze";
import { judge } from "./jev/weak";
import { getComponent } from "./modes";
import type { ModeId } from "./types";

/** One component in the analyzer output (01 contract: id, text, present, specificity, weak). */
export type AnalyzedComponent = JevComponent &
  Pick<DecomposedComponent, "text" | "spans" | "unmatched"> & {
    /** Jev says it is stated, but the decomposer found no span: rewrite from the whole prompt, don't ask (D29). */
    readonly unlocated: boolean;
  };

export type PromptAnalysis = {
  readonly mode: ModeId;
  readonly components: readonly AnalyzedComponent[];
  readonly jev: Pick<JevAnalysis, "model" | "usage">;
  readonly decompose: Pick<Decomposition, "usage">;
  readonly timingsMs: { readonly decompose: number; readonly jev: number; readonly total: number };
};

async function timed<T>(work: Promise<T>): Promise<[T, number]> {
  const t0 = Date.now();
  const result = await work;
  return [result, Date.now() - t0];
}

/** Merge decomposer spans into Jev's scores, re-judging each component now that spans are known. Pure. */
export function mergeAnalysis(parts: Decomposition, scores: JevAnalysis): AnalyzedComponent[] {
  const byId = new Map(parts.components.map((c) => [c.id, c]));
  return scores.components.map((score): AnalyzedComponent => {
    const part = byId.get(score.id);
    const text = part?.text ?? null;
    const def = getComponent(scores.mode, score.id);
    if (!def) throw new Error(`Unknown component "${score.id}" in mode "${scores.mode}".`);
    const judgment = judge(def, score.present, score.specificity.score, text !== null);
    return {
      ...score,
      ...judgment,
      text,
      spans: part?.spans ?? [],
      unmatched: part?.unmatched ?? [],
      unlocated: text === null && judgment.presence === "present",
    };
  });
}

/** Decomposer (Haiku) and Jev run in parallel; total time is the slower of the two. */
export async function analyzePrompt(
  clients: { anthropic: Anthropic; typesafe: TypeSafeClient },
  modeId: ModeId,
  prompt: string,
): Promise<PromptAnalysis> {
  if (!prompt.trim()) throw new Error("Prompt is empty.");

  const t0 = Date.now();
  const [[parts, decomposeMs], [scores, jevMs]] = await Promise.all([
    timed(decompose(clients.anthropic, modeId, prompt)),
    timed(analyzeWithJev(clients.typesafe, modeId, prompt)),
  ]);

  return {
    mode: modeId,
    components: mergeAnalysis(parts, scores),
    jev: { model: scores.model, usage: scores.usage },
    decompose: { usage: parts.usage },
    timingsMs: { decompose: decomposeMs, jev: jevMs, total: Date.now() - t0 },
  };
}
