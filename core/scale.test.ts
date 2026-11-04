import { describe, expect, it } from "vitest";
import { toRubricScale } from "./scale";

describe("toRubricScale (D14)", () => {
  it.each([
    [0, 1],
    [0.1, 1],
    [0.2, 1],
    [0.21, 2],
    [0.4, 2],
    [0.6, 3],
    [0.6000000001, 3],
    [0.8, 4],
    [0.95, 5],
    [1, 5],
  ])("maps %f to %i", (score, expected) => {
    expect(toRubricScale(score)).toBe(expected);
  });

  it.each([-0.1, 1.1, Number.NaN])("rejects %f", (score) => {
    expect(() => toRubricScale(score)).toThrow(RangeError);
  });
});
