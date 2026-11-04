import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { getMode } from "../modes";
import type { ModeId } from "../types";
import { DECOMPOSE_SYSTEM, buildDecomposeMessage } from "./prompt";
import { type Span, locateAll } from "./spans";

export const DECOMPOSE_MODEL = "claude-haiku-5-5";

export type DecomposedComponent = {
  readonly id: string;
  /** The component's excerpts joined in prompt order, or null when absent (D12). */
  readonly text: string | null;
  readonly spans: readonly Span[];
  /** Excerpts the model returned that are not in the prompt; dropped, kept for debugging. */
  readonly unmatched: readonly string[];
};

export type Decomposition = {
  readonly mode: ModeId;
  readonly components: readonly DecomposedComponent[];
  readonly usage: { readonly inputTokens: number; readonly outputTokens: number };
};

/** Network data is validated with Zod (Jev/Haiku edge rule). Ids are limited to this mode's components. */
function outputSchema(componentIds: readonly [string, ...string[]]) {
  return z.object({
    components: z.array(z.object({ id: z.enum(componentIds), excerpts: z.array(z.string()) })),
  });
}

/**
 * Split a prompt into component spans for the given mode with one Haiku call.
 * The client is passed in so the extension (background worker) and Node scripts
 * can each construct it their own way.
 */
export async function decompose(client: Anthropic, modeId: ModeId, prompt: string): Promise<Decomposition> {
  const mode = getMode(modeId);
  const ids = mode.components.map((c) => c.id) as [string, ...string[]];

  const response = await client.messages.parse({
    model: DECOMPOSE_MODEL,
    max_tokens: 8000,
    // Labeling is simple extraction; low effort keeps the button fast.
    output_config: { effort: "low", format: zodOutputFormat(outputSchema(ids)) },
    system: DECOMPOSE_SYSTEM,
    messages: [{ role: "user", content: buildDecomposeMessage(mode, prompt) }],
  });

  if (response.stop_reason === "refusal") throw new Error("Decomposer refused the prompt.");
  if (response.stop_reason === "max_tokens") throw new Error("Decomposer ran out of tokens.");
  const parsed = response.parsed_output;
  if (!parsed) throw new Error("Decomposer returned output that does not match the schema.");

  // Keep mode order and one entry per component, even if the model skipped or repeated one.
  const byId = new Map<string, string[]>();
  for (const c of parsed.components) byId.set(c.id, [...(byId.get(c.id) ?? []), ...c.excerpts]);

  const components = ids.map((id): DecomposedComponent => {
    const { spans, unmatched } = locateAll(prompt, byId.get(id) ?? []);
    return { id, text: spans.length ? spans.map((s) => s.text).join(" … ") : null, spans, unmatched };
  });

  return {
    mode: modeId,
    components,
    usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
  };
}
