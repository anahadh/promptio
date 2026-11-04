import { TypeSafeClient } from "@typesafe-ai/sdk";
import { describe, expect, it } from "vitest";
import { getComponent, getMode } from "../modes";
import { MODE_IDS, SPECIFICITY } from "../types";
import { analyzeWithJev } from "./analyze";
import { buildQuestions, presentKey, scoreKey } from "./questions";
import { THRESHOLDS, judge, levelOf, normalizeScore, presenceOf } from "./weak";

const goal = getComponent("coding", "goal")!; // required
const role = getComponent("coding", "role")!; // optional

describe("buildQuestions", () => {
  it.each(MODE_IDS)("asks one noul and one 4-level score per component (%s)", (id) => {
    const mode = getMode(id);
    const questions = buildQuestions(mode);
    expect(Object.keys(questions)).toHaveLength(mode.components.length * 2);
    for (const c of mode.components) {
      expect(questions[presentKey(c.id)]?.type).toBe("noul");
      const s = questions[scoreKey(c.id)];
      expect(s?.type).toBe("score");
      if (s?.type === "score") {
        expect(s.criteria).toHaveLength(SPECIFICITY.length);
        expect(s.criteria[3]).toMatchObject({ level: "precise", example: c.examples[3] });
      }
    }
  });
});

describe("weak rule", () => {
  it("maps noul probability to presence with the starting cutoffs", () => {
    expect(presenceOf(THRESHOLDS.presentYes)).toBe("present");
    expect(presenceOf(THRESHOLDS.presentNo)).toBe("absent");
    expect(presenceOf(0.5)).toBe("unsure");
  });

  it("normalizes Jev's 0-3 expected level to 0-1 and picks the nearest level", () => {
    expect(normalizeScore(0)).toBe(0);
    expect(normalizeScore(1.5)).toBe(0.5);
    expect(normalizeScore(3)).toBe(1);
    expect(levelOf(1.4)).toBe("general");
    expect(levelOf(2.6)).toBe("precise");
  });

  it("flags absent required parts as missing and skips absent optional ones (D16)", () => {
    expect(judge(goal, 0.1, 0)).toMatchObject({ status: "missing", weak: true });
    expect(judge(role, 0.1, 0)).toMatchObject({ status: "skipped", weak: false });
  });

  it("flags stated but vague parts, and keeps specific ones (D7)", () => {
    expect(judge(goal, 0.9, 0.3)).toMatchObject({ status: "vague", weak: true });
    expect(judge(goal, 0.9, 0.8)).toMatchObject({ status: "ok", weak: false });
  });

  it("judges required parts with unsure presence by specificity, never as missing", () => {
    expect(judge(goal, 0.5, 0.2)).toMatchObject({ presence: "unsure", status: "vague", weak: true });
    expect(judge(goal, 0.5, 0.9)).toMatchObject({ presence: "unsure", status: "ok" });
  });

  it("skips optional parts with unsure presence unless the decomposer found text (D17)", () => {
    expect(judge(role, 0.5, 0.1)).toMatchObject({ status: "skipped", weak: false });
    expect(judge(role, 0.5, 0.1, true)).toMatchObject({ status: "vague", weak: true });
  });

  it("never reports a part as missing when the decomposer found text for it", () => {
    expect(judge(goal, 0.1, 0.9, true)).toMatchObject({ presence: "unsure", status: "ok" });
    expect(judge(goal, 0.1, 0.1, true)).toMatchObject({ presence: "unsure", status: "vague" });
  });
});

describe("analyzeWithJev (fake transport)", () => {
  function clientReturning(answer: (name: string) => unknown, sent: { body?: unknown } = {}) {
    return new TypeSafeClient({
      apiKey: "test",
      compression: false,
      retry: { maxRetries: 0 },
      fetch: async (_url, init) => {
        const body = JSON.parse(String(init?.body));
        sent.body = body;
        const answers = Object.fromEntries(Object.keys(body.questions).map((name) => [name, answer(name)]));
        return new Response(JSON.stringify({ model: "jev-1.14.0", answers, usage: { input_tokens: 42, output_tokens: 0 } }), {
          headers: { "content-type": "application/json" },
        });
      },
    });
  }

  it("sends one batched request on the whole prompt and merges answers per component", async () => {
    const sent: { body?: unknown } = {};
    const client = clientReturning(
      (name) =>
        name.endsWith("__present")
          ? { type: "noul", noul: name.startsWith("goal") ? 0.95 : 0.05 }
          : { type: "score", score: name.startsWith("goal") ? 2.4 : 0, confidence: 0.6, legend: {}, probabilities: {} },
      sent,
    );

    const result = await analyzeWithJev(client, "coding", "fix the login page");
    expect(result.model).toBe("jev-1.14.0");
    expect(sent.body).toMatchObject({ model: "jev-latest", state: "fix the login page" });

    const byId = Object.fromEntries(result.components.map((c) => [c.id, c]));
    expect(byId.goal).toMatchObject({ status: "ok", weak: false, specificity: { level: "concrete" } });
    expect(byId.goal?.specificity.score).toBeCloseTo(0.8);
    expect(byId.tech_stack).toMatchObject({ status: "missing", weak: true });
    expect(byId.role).toMatchObject({ status: "skipped", weak: false });
  });

  it("rejects malformed answers instead of trusting them", async () => {
    const client = clientReturning((name) => (name.endsWith("__present") ? { type: "noul", noul: 7 } : { type: "score" }));
    await expect(analyzeWithJev(client, "ideas", "ideas please")).rejects.toThrow();
  });
});
