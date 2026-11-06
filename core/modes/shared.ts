import type { ComponentDef } from "../types";

/** Components every mode has (task-types.md, "Shared components"). */
export const SHARED_COMPONENTS = [
  {
    id: "goal",
    required: true,
    ifMissing: "ask",
    ask: "what outcome do you want?",
    present: "Does the prompt state the outcome the user wants?",
    score: "How specific is the stated outcome?",
    examples: [
      "help with my app",
      "fix the login",
      "add password reset to the login page",
      "add password reset by email to the login page; link expires in 1 hour",
    ],
  },
  {
    id: "context",
    required: true,
    ifMissing: "ask",
    ask: "what is the situation or background?",
    present: "Does the prompt state the situation or background the answer depends on?",
    score: "How specific is the stated situation or background?",
    examples: ["for my startup", "for a SaaS company", "B2B SaaS with paying customers", "B2B SaaS, 12 customers, Stripe billing"],
  },
  {
    id: "constraints",
    required: false,
    ifMissing: "ask",
    ask: "any limits or things to avoid?",
    present: "Does the prompt state limits, things that must not change, or things to avoid?",
    score: "How specific are the stated limits?",
    examples: ["keep it simple", "keep dependencies low", "no new dependencies", "no new dependencies; must run on Node 20"],
  },
  {
    // Required so the "how to respond" paragraph is always useful; a deliberate exception to D16.
    id: "output_format",
    required: true,
    ifMissing: "infer",
    present: "Does the prompt state the shape, length or structure of the reply?",
    score: "How specific is the requested reply format?",
    examples: ["explain it", "keep it short", "a diff and a summary", "a diff plus a 3-bullet summary"],
  },
  {
    // D17: improved when present, never injected when absent.
    id: "role",
    required: false,
    ifMissing: "infer",
    present: "Does the prompt give the model a persona or area of expertise?",
    score: "How specific is the persona or expertise?",
    examples: [
      "act as an expert",
      "act as a database expert",
      "act as a senior Postgres DBA",
      "act as a senior Postgres DBA reviewing for lock contention",
    ],
  },
] as const satisfies readonly ComponentDef[];
