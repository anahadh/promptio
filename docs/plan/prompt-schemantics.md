# 01: Prompt schemantics

**Status:** done. **Summary:** A prompt is good for a mode when it covers that mode's components, each specific enough to act on. **Depends on:** none. **Decisions:** D4, D5, D6, D7, D12-D15.

## Goal
Give a measurable, per-part definition of prompt quality that Jev can score and Haiku can improve.

## Interface contract
- Input: `{ mode: ModeId, prompt: string }`
- Output: `{ components: [{ id, text, present: number (0-1), specificity: ScoreResult, weak: boolean }] }`
  - `id` is the component type (e.g. `"role"`). It selects that component's Jev questions and rubric.
  - `text` is the span of the prompt that fills it (e.g. `"you are to act as a doctor..."`), or `null` when absent. Haiku rewrites this span, and feature 04 splices it back (D12).
- `present` comes from a Noul question. `specificity` comes from a Score question. `weak` is true when specificity is below the threshold or the component is absent.
- No prompt-level score at runtime. Per-component `weak` flags drive all behaviour (D13).
- Component lists per mode are defined in feature 02.

## Design
- Per component, Jev answers two narrow questions in one batched request (D4):
  - Noul: "Does the prompt state X?"
  - Score: "How specific is X?", with ordered levels from vague to precise and testable.
- Only weak components go to Haiku (D7).

## Validation (dev-time only, D5, D6)
- 30-50 prompts per mode, sampled from public chat logs (WildChat, LMSYS-Chat-1M) and topped up with synthetic prompts where a mode is thin.
- Original and enhanced versions are run on Claude, GPT and Gemini.
- Outputs are graded on a 4-criterion rubric for each mode. The user approves each mode's criteria before use (D14).
- The grader is Jev Score. Its 0-1 output maps to 1-5 as `clamp(ceil(s * 5), 1, 5)`, so 0.2 → 1, 0.4 → 2, ... 1.0 → 5 (D14).
- Pass: enhanced beats original on most pairs.

## Threshold calibration (D15)
No hand labels. The threshold comes from downstream outcomes:
1. For each validation prompt, rewrite each component on its own and record its original specificity `s`.
2. Grade the output with and without that single rewrite, giving a gain `Δ`.
3. Set the threshold at the `s` above which the mean `Δ` stops being positive, meaning rewriting no longer helps.

To limit cost, calibration runs against one target model.

## Open questions
None.

## Done criteria
- User agrees to the revised contract (component `text` added, prompt score removed).
- Status set to done in `00-index.md`.
