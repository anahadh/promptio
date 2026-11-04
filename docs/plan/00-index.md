# Promptio: feature index

**Active feature:** none. Built so far: mode data (02), Haiku decomposer, Jev client (part of 05). Next: rewriter (06). Open problems: `../problems.md`.

Rules: one feature active at a time. Each feature goes draft, user review, done. Decisions go to `decisions.md`.

| # | Feature | File | State | Depends on |
|---|---|---|---|---|
| 01 | Prompt schemantics | `prompt-schemantics.md` | done | none |
| 02 | Task types and per-mode structures | `task-types.md` | done | 01 |
| 04 | Prompt decomposition and reassembly | (not yet created) | todo | 02 |
| 05 | Jev analyzer schema | (not yet created) | todo | 01, 04 |
| 06 | Haiku enhancer (per-part, parallel, merge) | (not yet created) | todo | 04, 05 |
| 03 | Systems architecture | (not yet created) | todo | 04, 05, 06 |
| 09 | Extension UI and site adapters | (not yet created) | todo | 03 |
| 07 | Eval harness | `eval-harness.md` (notes) | todo | 01, 06 |
| 08 | Intent preservation and safety | (not yet created) | todo | 06 |
| 10 | Mode and option system | (not yet created) | todo | 02 |
| 11 | Repo structure and parallel-work protocol | (not yet created) | todo | 03 |
| 12 | Milestones and MVP scope | (not yet created) | todo | all |
| 13 | Risks and open questions | (not yet created) | todo | all |
| 14 | Missing-info fill (infer / ask, non-blocking) | (not yet created) | todo | 02, 06 |

## Parked (post-MVP)
- Friction cap: at most 2 questions per enhancement (D23).
- Local user profile that answers repeat questions (D23).

## Later (not parked, just not now)
- Expand `fixedConstraints` for every mode; the current ones are too thin (D27).
- Brainstorm: let Jev classify the prompt's parts instead of Haiku. Jev ran in ~235 ms vs ~1.4-2.1 s for Haiku. Sentence splitting is unreliable, so piece-finding needs another approach.
- Shared components overlap with mode-specific ones (context vs audience, constraints vs tone). Jev counts them as present while Haiku gives the span to one, which produces "unlocated" rows. Decide whether to merge or sharpen them.
