# 01: Good prompt definition

**Status:** drafting. **Summary:** A prompt is good for a mode when it covers that mode's components, each specific enough to act on. **Depends on:** none. **Decisions:** D4, D5, D6, D7.

## Goal
Give a measurable, per-part definition of prompt quality that Jev can score and Haiku can improve.

## Interface contract
- Input: `{ mode: ModeId, prompt: string }`
- Output: `{ components: [{ id, present: number (0-1), specificity: ScoreResult, weak: boolean }], promptScore: number }`
- `present` comes from a Noul question. `specificity` comes from a Score question. `weak` is true when the combined score is below the threshold.
- Component lists per mode are defined in feature 02 and are a dependency of this one.

## Design
- Per component, Jev answers two narrow questions in one batched request (D4):
  - Noul: "Does the prompt state X?" (defined precisely, per D4 guidance)
  - Score: "How specific is X?", with ordered levels from absent/vague to precise and testable.
- `promptScore` is a weighted sum of component scores. Weights live in code (D4).
- A component is weak below a threshold. Only weak components go to Haiku (D7).
- Threshold and weights are calibrated on a small labeled set, because Jev does not document its score range or calibration procedure.
- Validation is dev-time only (D5, D6): 30-50 prompts per mode. Produce original and enhanced versions, run both on Claude, GPT and Gemini, and grade with a rubric. Pass when enhanced beats original on most pairs and the structure score correlates with output grade.

## Open questions
1. Grading rubric for downstream outputs. Proposal: a per-mode rubric with 3-5 criteria, each scored 1-5 by a grader model. Confirm, or name another approach.
2. Who labels the calibration set? Proposal: the user labels about 20 prompts; the rest are tuned against those.

## Done criteria
- Both open questions answered and recorded in `decisions.md`.
- Interface contract and weighting approach agreed by the user.
- Status set to done in `00-index.md`.
