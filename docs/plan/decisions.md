# Decisions (append-only)

Add new decisions at the bottom with the next number. Never edit another item's file to change a decision; record it here.

| # | Decision |
|---|---|
| D1 | Surface: Chrome extension on Claude.ai, Gemini, ChatGPT first; other surfaces later. |
| D2 | Open source on GitHub, also published to the Chrome Web Store. |
| D3 | BYOK for v1: users store their own TypeSafe and Anthropic keys locally. No backend. Hosted proxy is a later option. |
| D4 | Jev = TypeSafe judgment model. Typed questions (Score / Noul / Choice), independent and parallel, one narrow question per judgment, combined in our code. |
| D5 | "Good prompt" = has the structure best suited to its mode. Research and validation are dev-time only; nothing is trained at runtime. |
| D6 | A small downstream validation set (~30-50 prompts per mode, original vs. enhanced, run on Claude/GPT/Gemini) checks the structure definitions are right. Dev-time only. |
| D7 | Only parts scoring below a threshold are rewritten. Strong parts stay verbatim. |
| D8 | Trigger: clicking a mode option starts enhancement immediately on whatever is in the chat bar. |
| D9 | Result streams into the chat bar live; original restorable (undo). |
| D10 | Cut for v1: privacy/legal, cost/latency strategy, testing/CI as separate items. Architecture keeps a short "what data goes where" note and a latency/cost budget. Testing is folded into the eval harness. |
| D11 | Pace: fast. Ask the user only when genuinely unsure. |
| D12 | Component results carry both `id` (component type) and `text` (the matched prompt span, or null). |
| D13 | No prompt-level score at runtime. Per-component `weak` drives behaviour. Supersedes the `promptScore` and weights in 01's first draft. |
| D14 | Downstream rubric: 4 criteria per mode, each approved by the user before use. Grader is Jev Score, mapped to 1-5 via `clamp(ceil(s*5),1,5)`. |
| D15 | Weak threshold is calibrated from downstream gain (single-component rewrites), not hand labels. Validation prompts come from WildChat / LMSYS-Chat-1M plus synthetic prompts. |
| D16 | Components are `required` or optional. An absent required component is weak. An absent optional one is skipped, not added. Refines 01's "absent ⇒ weak". |
| D17 | `role` is an optional shared component: scored and improved when present, never injected when absent. |
| D18 | v1 modes: `coding`, `ideas`, `business_plan`. Each is a data file (`ModeDef`). The mode comes from the user's click, with no auto-detection. |
| D19 | In our data model, the presence question field is named `present`. "Noul" appears only inside the Jev client. |
| D20 | v1 modes: `writing`, `coding`, `research`, `learning`, `analysis`, `ideas`. Business plan and advice are dropped for now. Supersedes D18's mode list; the rest of D18 still stands. |
| D21 | Component changes: writing `tone` required; research `sources` required, `known_info` removed; learning `focus` replaced by required `objective`, `method` required; analysis `method` required (default: choose and justify); ideas `audience` removed, `quantity_range` becomes optional inferred `scale`, `criteria` required. |
| D22 | Every component has a `fill` type: `infer` (Haiku writes a default) or `ask` (check chat history, then ask inline; skipping inserts a `[placeholder]`). Never invent user-only facts. Settled parts enhance immediately; questions block only their own parts. Detailed in feature 14. |
| D23 | Post-MVP, parked: friction cap (max 2 questions per enhancement) and a local user profile that answers repeat questions. Revisit in feature 12. |
| D24 | Every rubric criterion must be judgeable from the prompt and the output alone, with no outside facts or search. Coding correctness is checked by running tests, not by Jev. |
| D25 | Shared specificity scale `vague / general / concrete / precise`. Each component defines only one short example per level (`examples`), not long level text. Runtime results report a single level value. Supersedes `levels` in 02. |
| D26 | `fill` renamed to `ifMissing`. It stays fixed per component because it encodes who could know the answer, which the model must not decide (D22). Runtime still checks the prompt and chat history first. |
| D27 | `fixedConstraints` are first drafts and too thin; expand them for every mode later. |
| D28 | The decomposer (Haiku 5.5, low effort, structured output) returns verbatim excerpts per component. Code locates each excerpt with offsets (whitespace-tolerant only) and drops anything not in the prompt. `text` (D12) = the excerpts joined in order. |
| D29 | Jev: one batched `systemOne` request per enhancement, with a Noul and a 4-level structured Score per component, run on the whole prompt in parallel with the decomposer. Model `jev-latest` (pin when calibrating, D15); the resolved version is logged. Starting thresholds: present ≥ 0.7, absent ≤ 0.3, weak if normalized score < 0.5. Jev-present but no span = "unlocated": rewrite from the whole prompt, don't ask. Corrects D14: Jev Score runs 0..levels-1, not 0-1, so the rubric mapping is fixed in the eval harness. |
