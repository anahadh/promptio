/**
 * Map a Jev rubric Score to the 1-5 rubric scale (D14, corrected by D29).
 * Jev's Score is the expected level index, 0..levels-1, not 0-1. Rubric criteria use
 * 5 levels, so the expected index 0..4 maps to 1..5 by adding one. Fractional values
 * are kept, so averages across eval cases stay precise.
 */
export const RUBRIC_LEVELS = 5;

export function toRubricScale(raw: number): number {
  if (!Number.isFinite(raw) || raw < 0 || raw > RUBRIC_LEVELS - 1) {
    throw new RangeError(`Rubric score must be in [0, ${RUBRIC_LEVELS - 1}], got ${raw}`);
  }
  return raw + 1;
}
