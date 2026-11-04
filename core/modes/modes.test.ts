import { describe, expect, it } from "vitest";
import { MODE_IDS, SPECIFICITY } from "../types";
import { MODES, SHARED_COMPONENTS, getComponent } from "./index";

// Rules the type system can't express (task-types.md, D14, D16, D17, D20-D24).
describe.each(MODE_IDS)("mode %s", (modeId) => {
  const mode = MODES[modeId];

  it("is registered under its own id", () => {
    expect(mode.id).toBe(modeId);
  });

  it("has unique component ids", () => {
    const ids = mode.components.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("starts with every shared component, unchanged", () => {
    expect(mode.components.slice(0, SHARED_COMPONENTS.length)).toEqual(SHARED_COMPONENTS);
  });

  it("has at least one mode-specific required component", () => {
    const specific = mode.components.slice(SHARED_COMPONENTS.length);
    expect(specific.length).toBeGreaterThan(0);
    expect(specific.some((c) => c.required)).toBe(true);
  });

  it("uses snake_case ids for components and criteria", () => {
    const ids = [...mode.components.map((c) => c.id), ...mode.rubric.map((r) => r.id)];
    for (const id of ids) expect(id).toMatch(/^[a-z]+(_[a-z]+)*$/);
  });

  it("phrases every component as presence and specificity questions with one distinct example per level", () => {
    for (const c of mode.components) {
      expect(c.present, c.id).toMatch(/^Does the prompt .+\?$/);
      expect(c.score, c.id).toMatch(/^How (specific|complete) .+\?$/);
      expect(c.examples).toHaveLength(SPECIFICITY.length);
      expect(new Set(c.examples).size, c.id).toBe(SPECIFICITY.length);
      for (const example of c.examples) expect(example.trim().length, c.id).toBeGreaterThan(0);
    }
  });

  it("has a 4-criterion rubric with unique ids, each phrased as a question", () => {
    expect(mode.rubric).toHaveLength(4);
    expect(new Set(mode.rubric.map((r) => r.id)).size).toBe(4);
    for (const r of mode.rubric) expect(r.question).toMatch(/\?$/);
  });

  it("only uses execution judging for coding correctness (D24)", () => {
    for (const r of mode.rubric) {
      if (r.judge === "exec") expect([modeId, r.id]).toEqual(["coding", "correctness"]);
    }
  });
});

describe("cross-mode rules", () => {
  it("registers exactly the v1 modes (D20)", () => {
    expect(Object.keys(MODES).sort()).toEqual([...MODE_IDS].sort());
  });

  it("keeps role optional and inferred, so it is never injected (D17)", () => {
    for (const id of MODE_IDS) {
      expect(getComponent(id, "role")).toMatchObject({ required: false, ifMissing: "infer" });
    }
  });

  it("requires goal and context in every mode", () => {
    for (const id of MODE_IDS) {
      expect(getComponent(id, "goal")?.required).toBe(true);
      expect(getComponent(id, "context")?.required).toBe(true);
    }
  });

  it("gives writing the anti-slop constraints and no other mode any (D21)", () => {
    for (const id of MODE_IDS) {
      if (id === "writing") expect(MODES[id].fixedConstraints.length).toBeGreaterThan(0);
      else expect(MODES[id].fixedConstraints).toEqual([]);
    }
  });

  it("matches the component decisions in D21", () => {
    expect(getComponent("writing", "tone")?.required).toBe(true);
    expect(getComponent("research", "sources")?.required).toBe(true);
    expect(getComponent("research", "known_info")).toBeUndefined();
    expect(getComponent("learning", "objective")?.required).toBe(true);
    expect(getComponent("learning", "method")?.required).toBe(true);
    expect(getComponent("learning", "focus")).toBeUndefined();
    expect(getComponent("analysis", "method")).toMatchObject({ required: true, ifMissing: "infer" });
    expect(getComponent("ideas", "audience")).toBeUndefined();
    expect(getComponent("ideas", "scale")).toMatchObject({ required: false, ifMissing: "infer" });
    expect(getComponent("ideas", "criteria")?.required).toBe(true);
  });
});
