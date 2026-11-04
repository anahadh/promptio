import type { ModeDef } from "../types";
import { SHARED_COMPONENTS } from "./shared";

export const learning = {
  id: "learning",
  label: "Learning",
  components: [
    ...SHARED_COMPONENTS,
    {
      id: "level",
      required: true,
      ifMissing: "ask",
      present: "Does the prompt state what the learner already knows?",
      score: "How specific is the learner's stated level?",
      examples: ["(no level given)", "beginner", "I know basic Python", "know Python basics, never used recursion"],
    },
    {
      id: "objective",
      required: true,
      ifMissing: "ask",
      present: "Does the prompt state what the learner wants to be able to do afterwards?",
      score: "How specific is the learning objective?",
      examples: [
        "teach me recursion",
        "understand recursion",
        "write a recursive function",
        "write and trace a recursive tree walk",
      ],
    },
    {
      id: "method",
      required: true,
      ifMissing: "infer",
      present: "Does the prompt state how the material should be taught?",
      score: "How specific is the requested teaching method?",
      examples: [
        "teach me",
        "with examples",
        "explain, then give practice problems",
        "explain, then 3 practice problems with answers hidden",
      ],
    },
  ],
  fixedConstraints: [],
  rubric: [
    {
      id: "level_fit",
      judge: "jev",
      question:
        "Does the output start from the level the prompt states, without re-explaining what the learner knows or skipping what they lack?",
    },
    { id: "objective", judge: "jev", question: "Does the output work directly toward the objective stated in the prompt?" },
    { id: "method", judge: "jev", question: "Does the output teach in the way the prompt asks for?" },
    { id: "self_check", judge: "jev", question: "Does the output include a way for the learner to check their understanding?" },
  ],
} as const satisfies ModeDef;
