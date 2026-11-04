import { describe, expect, it } from "vitest";
import { toRubricScale } from "./scale";

describe("toRubricScale (D14 as corrected by D29)", () => {
  it.each([
    [0, 1],
    [1, 2],
    [2.5, 3.5],
    [4, 5],
  ])("maps expected level %f to %f", (raw, expected) => {
    expect(toRubricScale(raw)).toBe(expected);
  });

  it.each([-0.1, 4.1, Number.NaN])("rejects %f", (raw) => {
    expect(() => toRubricScale(raw)).toThrow(RangeError);
  });
});
