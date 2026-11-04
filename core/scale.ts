/**
 * Map a Jev Score (0-1) to the 1-5 rubric scale (D14): 0.2 -> 1, 0.4 -> 2, ... 1.0 -> 5.
 * In-between values round up; 0 counts as 1.
 */
export function toRubricScale(score: number): 1 | 2 | 3 | 4 | 5 {
  if (!Number.isFinite(score) || score < 0 || score > 1) {
    throw new RangeError(`Jev score must be in [0, 1], got ${score}`);
  }
  // Round to 6 decimals first so float noise (e.g. 0.6000000001) doesn't bump a level.
  const scaled = Math.ceil(Math.round(score * 5 * 1e6) / 1e6);
  return Math.min(5, Math.max(1, scaled)) as 1 | 2 | 3 | 4 | 5;
}
