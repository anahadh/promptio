import type Anthropic from "@anthropic-ai/sdk";
import { ENHANCE_SYSTEM } from "./prompt";

export const ENHANCE_MODEL = "claude-haiku-5-5";

export type GeneratedPart = {
  readonly text: string;
  readonly usage: { readonly inputTokens: number; readonly outputTokens: number };
};

/** Generates one part from its message, reporting text as it streams. Injected so tests need no API. */
export type PartGenerator = (message: string, onDelta: (delta: string) => void) => Promise<GeneratedPart>;

/** Streaming Haiku generator. Plain text output, so it can appear word by word. */
export function haikuGenerator(client: Anthropic): PartGenerator {
  return async (message, onDelta) => {
    const stream = client.messages.stream({
      model: ENHANCE_MODEL,
      max_tokens: 8000,
      output_config: { effort: "medium" },
      system: ENHANCE_SYSTEM,
      messages: [{ role: "user", content: message }],
    });
    stream.on("text", (delta) => onDelta(delta));

    const response = await stream.finalMessage();
    if (response.stop_reason === "refusal") throw new Error("Haiku refused this part.");
    if (response.stop_reason === "max_tokens") throw new Error("Haiku ran out of tokens on this part.");

    const text = response.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("");
    return {
      text,
      usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
    };
  };
}
