import type { ModeDef } from "../types";
import { SHARED_COMPONENTS } from "./shared";

export const ideas = {
  id: "ideas",
  label: "Ideas",
  components: [
    ...SHARED_COMPONENTS,
    {
      id: "criteria",
      required: true,
      ifMissing: "ask",
      present: "Does the prompt state what makes an idea good here?",
      score: "How specific are the criteria for a good idea?",
      examples: ["good ones", "cheap and quick", "low budget, fast to try", "under $500, testable in a week"],
    },
    {
      id: "scale",
      required: false,
      ifMissing: "infer",
      present: "Does the prompt state how many ideas, or how ambitious they should be?",
      score: "How specific is the requested number and ambition of ideas?",
      examples: ["some ideas", "a few quick ideas", "5 options", "5 quick options for tonight"],
    },
  ],
  fixedConstraints: [],
  rubric: [
    { id: "criteria_fit", judge: "jev", question: "Do the ideas meet the criteria and constraints the prompt states?" },
    { id: "novelty", judge: "jev", question: "Do the ideas go beyond the obvious first answers?" },
    { id: "range", judge: "jev", question: "Are the ideas distinct from each other, not variations of one idea?" },
    { id: "scale_fit", judge: "jev", question: "Do the number and ambition of the ideas match the task?" },
  ],
} as const satisfies ModeDef;
