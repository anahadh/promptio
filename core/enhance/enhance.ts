import type Anthropic from "@anthropic-ai/sdk";
import type { TypeSafeClient } from "@typesafe-ai/sdk";
import { type PromptAnalysis, analyzePrompt } from "../analyze-prompt";
import { getMode } from "../modes";
import type { ModeId } from "../types";
import { type PartGenerator, haikuGenerator } from "./generate";
import { checkNumbers, leaksProcess } from "./guard";
import { type EnhancementPlan, type PartAction, planEnhancement } from "./plan";
import { buildPartMessage } from "./prompt";
import { InOrderReveal, type PartState, assemble } from "./reveal";

export type PartOutcome = {
  readonly id: string;
  readonly paragraph: number;
  readonly action: PartAction;
  readonly excerpts: readonly string[];
  readonly text: string;
  /** generated: Haiku's text is used. static: no AI. rejected or failed: fell back to the user's text. */
  readonly outcome: "generated" | "static" | "rejected" | "failed";
  readonly warning: string | null;
};

export type EnhanceProgress = {
  /** The text the user should see now, revealed strictly in order. */
  readonly text: string;
  readonly parts: readonly { readonly id: string; readonly action: PartAction; readonly state: PartState }[];
};

export type EnhanceResult = {
  readonly mode: ModeId;
  readonly original: string;
  readonly text: string;
  readonly parts: readonly PartOutcome[];
  readonly omitted: EnhancementPlan["omitted"];
  readonly analysis: PromptAnalysis;
  readonly usage: { readonly inputTokens: number; readonly outputTokens: number };
  readonly timingsMs: { readonly analysis: number; readonly generation: number; readonly total: number };
};

export type EnhanceOptions = {
  readonly onUpdate?: (progress: EnhanceProgress) => void;
  /** Fires once analysis and planning finish, before any generation. */
  readonly onPlan?: (plan: EnhancementPlan, analysis: PromptAnalysis) => void;
};

/** Generate every part in parallel and reveal the results in order. A failed part never fails the run. */
export async function enhanceFromAnalysis(
  generate: PartGenerator,
  analysis: PromptAnalysis,
  prompt: string,
  options: EnhanceOptions = {},
): Promise<Pick<EnhanceResult, "text" | "parts" | "omitted" | "usage">> {
  const mode = getMode(analysis.mode);
  const plan = planEnhancement(analysis.mode, prompt, analysis.components);
  options.onPlan?.(plan, analysis);

  const reveal = new InOrderReveal(plan.parts);
  const usage = { inputTokens: 0, outputTokens: 0 };
  const emit = () =>
    options.onUpdate?.({
      text: reveal.text(),
      parts: reveal.states().map((state, i) => {
        const part = plan.parts[i]!;
        return { id: part.id, action: part.action, state };
      }),
    });
  emit();

  const outcomes = await Promise.all(
    plan.parts.map(async (part, index): Promise<PartOutcome> => {
      const base = { id: part.id, paragraph: part.paragraph, action: part.action, excerpts: part.excerpts };
      if (part.staticText !== null) return { ...base, text: part.staticText, outcome: "static", warning: null };

      const original = part.excerpts.join(" ");
      const others = plan.parts.filter((p) => p !== part);
      let result: Pick<PartOutcome, "text" | "outcome" | "warning">;
      try {
        const generated = await generate(buildPartMessage(mode, prompt, part, others), (delta) => {
          reveal.append(index, delta);
          emit();
        });
        usage.inputTokens += generated.usage.inputTokens;
        usage.outputTokens += generated.usage.outputTokens;

        const text = generated.text.trim();
        if (!text) throw new Error("Haiku returned no text.");
        const verdict = checkNumbers(part, prompt, text);
        if (leaksProcess(text)) {
          result = { text: original, outcome: "rejected", warning: `Rejected: commented on the task instead of writing it ("${text}").` };
        } else if (verdict.outcome === "reject") {
          const warning = `Rejected: added ${verdict.numbers.join(", ")}, which the prompt doesn't state.`;
          result = { text: original, outcome: "rejected", warning };
        } else {
          const warning = verdict.outcome === "warn" ? `Default adds ${verdict.numbers.join(", ")}.` : null;
          result = { text, outcome: "generated", warning };
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        result = { text: original, outcome: "failed", warning: `Generation failed: ${reason}` };
      }

      reveal.finish(index, result.text);
      emit();
      return { ...base, ...result };
    }),
  );

  return {
    text: assemble(outcomes),
    parts: outcomes,
    omitted: plan.omitted,
    usage,
  };
}

/**
 * Turn a prompt into a structured prompt for the given mode. Rejects if analysis fails or
 * the prompt is empty, so the caller keeps the user's prompt untouched.
 */
export async function enhancePrompt(
  clients: { anthropic: Anthropic; typesafe: TypeSafeClient },
  modeId: ModeId,
  prompt: string,
  options: EnhanceOptions = {},
): Promise<EnhanceResult> {
  const t0 = Date.now();
  const analysis = await analyzePrompt(clients, modeId, prompt);
  const t1 = Date.now();
  const result = await enhanceFromAnalysis(haikuGenerator(clients.anthropic), analysis, prompt, options);
  const t2 = Date.now();

  return {
    mode: modeId,
    original: prompt,
    analysis,
    ...result,
    timingsMs: { analysis: t1 - t0, generation: t2 - t1, total: t2 - t0 },
  };
}
