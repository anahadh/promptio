# Promptio

Open-source Chrome extension (MV3). A fire button beside the chat bar on Claude.ai, ChatGPT and Gemini rewrites the user's prompt for a chosen mode, part by part. BYOK: users paste their own TypeSafe and Anthropic keys. There is no backend (D3).

## How it works
1. The user picks a mode: `writing`, `coding`, `research`, `learning`, `analysis` or `ideas` (D20). There is no auto-detection.
2. Two calls run **in parallel** (`core/analyze-prompt.ts`):
   - **Decomposer** (Haiku 5.5, `core/decompose/`): returns verbatim excerpts per component. Code locates them with offsets and drops anything not in the prompt (D28).
   - **Jev** (TypeSafe, `core/jev/`): one batched request with a Noul (present?) and a 4-level structured Score (how specific?) per component, on the whole prompt (D29).
3. Each component's status: `ok` (kept verbatim) / `vague` (rewrite) / `missing` (required: infer or ask the user, D22) / `skipped` (optional and absent, never injected, D16/D17).
4. **Not built yet:** the Haiku rewriter for weak parts (06), reassembly (04), the ask flow (14), and the fire-button UI and site adapters (09).

## Layout
- `core/`: pure TypeScript with no Chrome APIs, reused by the extension and the future eval harness.
  - `types.ts`: `ModeDef`, `ComponentDef`, `SPECIFICITY` scale.
  - `modes/`: one data file per mode plus the shared components, checked with `satisfies ModeDef`.
- `extension/`: the WXT shell (background worker, content script, settings page). API calls belong in the background worker.
- `scripts/` (gitignored): local live tools; they need `.env.local` (see `.env.example`).
- `docs/` (gitignored): `plan/` (start with `00-index.md` and `decisions.md`) and `problems.md` (open problems and audit log).

## Commands
- `npm test` · `npm run typecheck` · `npm run build` · `npm run dev` (Chrome with the extension loaded)
- `npm run jev:viewer`: local page showing how Jev classifies any prompt (presence, level distribution, exact questions)
- `npm run demo:analyze` / `npm run demo:decompose`: HTML reports for the sample prompts

## Conventions
- Data we write uses types plus rule tests (`modes.test.ts`). Network data from Jev or Haiku is validated with Zod at the edge.
- Models: Haiku 5.5 (`claude-haiku-5-5`) for decomposing and rewriting. Jev is `jev-latest` until thresholds are calibrated (D15).
- Haiku must never invent facts only the user knows (D22).
- Rubrics grade outputs at dev time only, and must be judgeable from the prompt and output alone (D24).
- Log new problems in `docs/problems.md`. Lock decisions in `docs/plan/decisions.md` (append-only, cite by D-ID).

## Working style
- One feature at a time: draft, user review, then done. Keep feature files under ~150 lines.
- Fast pace. Ask only when genuinely unsure.
- Challenge the user's ideas when there is good reason.
