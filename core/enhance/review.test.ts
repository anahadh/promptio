import { TypeSafeClient } from "@typesafe-ai/sdk";
import { describe, expect, it } from "vitest";
import type { PromptAnalysis } from "../analyze-prompt";
import { reviewEnhancement } from "./review";

function client(answer: (name: string) => unknown) {
  return new TypeSafeClient({
    apiKey: "test",
    compression: false,
    retry: { maxRetries: 0 },
    fetch: async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      const answers = Object.fromEntries(Object.keys(body.questions).map((name) => [name, answer(name)]));
      return new Response(JSON.stringify({ model: "jev-test", answers, usage: { input_tokens: 1, output_tokens: 0 } }), {
        headers: { "content-type": "application/json" },
      });
    },
  });
}

const analysis = {
  mode: "ideas",
  components: [
    { id: "goal", weak: true },
    { id: "role", weak: false },
  ],
} as unknown as PromptAnalysis;

describe("reviewEnhancement", () => {
  it("compares weak parts before and after, and reports the flags", async () => {
    const review = await reviewEnhancement(
      client((name) => {
        if (name === "repeats") return { type: "noul", noul: 0.2 };
        if (name === "sameTask") return { type: "noul", noul: 0.9 };
        if (name === "commentary") return { type: "noul", noul: 0.1 };
        if (name.endsWith("__present")) return { type: "noul", noul: name.startsWith("criteria") ? 0.05 : 0.95 };
        return { type: "score", score: 3, confidence: 1, legend: {}, probabilities: {} };
      }),
      analysis,
      "ideas please",
      "Give me ideas.",
    );
    expect(review).toEqual({
      weakBefore: ["goal"],
      weakAfter: ["criteria"],
      repeats: 0.2,
      sameTask: 0.9,
      commentary: 0.1,
    });
  });
});
