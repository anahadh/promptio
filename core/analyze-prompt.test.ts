import { describe, expect, it } from "vitest";
import { mergeAnalysis } from "./analyze-prompt";
import type { Decomposition } from "./decompose/decompose";
import type { JevAnalysis, JevComponent } from "./jev/analyze";
import { judge } from "./jev/weak";
import { getComponent, getMode } from "./modes";

/** Build a Jev result for every ideas component, overriding presence/score per id. */
function jev(overrides: Record<string, { present: number; score: number }>): JevAnalysis {
  const components = getMode("ideas").components.map((def): JevComponent => {
    const { present, score } = overrides[def.id] ?? { present: 0.05, score: 0 };
    return {
      id: def.id,
      present,
      specificity: { score, raw: score * 3, level: "vague", confidence: 1, probabilities: [1, 0, 0, 0] },
      ...judge(def, present, score),
    };
  });
  return { mode: "ideas", model: "jev-test", components, usage: { inputTokens: 0 }, raw: {} };
}

function parts(texts: Record<string, string>): Decomposition {
  return {
    mode: "ideas",
    usage: { inputTokens: 0, outputTokens: 0 },
    components: getMode("ideas").components.map((def) => {
      const text = texts[def.id] ?? null;
      return { id: def.id, text, spans: text ? [{ text, start: 0, end: text.length }] : [], unmatched: [] };
    }),
  };
}

const byId = (list: ReturnType<typeof mergeAnalysis>) => Object.fromEntries(list.map((c) => [c.id, c]));

describe("mergeAnalysis", () => {
  it("keeps every component in mode order with its span text", () => {
    const merged = mergeAnalysis(parts({ goal: "ideas for an offsite" }), jev({ goal: { present: 0.9, score: 0.4 } }));
    expect(merged.map((c) => c.id)).toEqual(getMode("ideas").components.map((c) => c.id));
    expect(byId(merged).goal).toMatchObject({ text: "ideas for an offsite", status: "vague", unlocated: false });
  });

  it("marks parts Jev finds but Haiku can't locate as unlocated, not missing", () => {
    const c = byId(mergeAnalysis(parts({}), jev({ context: { present: 0.9, score: 0.3 } }))).context;
    expect(c).toMatchObject({ text: null, unlocated: true, status: "vague" });
  });

  it("does not ask for a required part the user wrote, even if Jev says absent", () => {
    const c = byId(mergeAnalysis(parts({ criteria: "under $500" }), jev({ criteria: { present: 0.1, score: 0.8 } }))).criteria;
    expect(c).toMatchObject({ presence: "unsure", status: "ok", weak: false });
  });

  it("still reports required parts as missing when neither finds them", () => {
    expect(byId(mergeAnalysis(parts({}), jev({}))).criteria).toMatchObject({ status: "missing", weak: true });
    expect(getComponent("ideas", "criteria")?.required).toBe(true);
  });
});
