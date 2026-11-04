import type { ModeDef } from "../types";
import { SHARED_COMPONENTS } from "./shared";

export const analysis = {
  id: "analysis",
  label: "Analysis",
  components: [
    ...SHARED_COMPONENTS,
    {
      id: "material",
      required: true,
      ifMissing: "ask",
      present: "Does the prompt provide or describe the data or document to analyze?",
      score: "How specific is the provided or described material?",
      examples: [
        "my sales data (not attached)",
        "a spreadsheet of sales",
        "a CSV of monthly sales by region",
        "attached CSV: date, region, units, revenue",
      ],
    },
    {
      id: "method",
      required: true,
      // When absent, the inferred default is "choose and justify the method first" (D21).
      ifMissing: "infer",
      present: "Does the prompt state the comparisons, metrics or tests to use?",
      score: "How specific is the requested analysis method?",
      examples: [
        "analyze it",
        "look at trends",
        "compare month over month",
        "month-over-month by region; flag outliers > 2σ",
      ],
    },
    {
      id: "decision",
      required: false,
      ifMissing: "ask",
      present: "Does the prompt state what decision the analysis will inform?",
      score: "How specific is the decision the analysis informs?",
      examples: ["insights", "help with budgeting", "decide on ad spend", "decide whether to cut the Q3 ad budget"],
    },
  ],
  fixedConstraints: [],
  rubric: [
    {
      id: "grounding",
      judge: "jev",
      question: "Does every finding cite specific values or passages from the provided material, and none from outside it?",
    },
    { id: "method", judge: "jev", question: "Does the output state its method and apply it, whether requested or justified?" },
    { id: "relevance", judge: "jev", question: "Do the findings answer the question or inform the decision the prompt states?" },
    { id: "caveats", judge: "jev", question: "Does the output note the limits of the data and its confidence?" },
  ],
} as const satisfies ModeDef;
