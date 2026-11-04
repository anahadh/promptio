import type { ModeDef } from "../types";
import { SHARED_COMPONENTS } from "./shared";

export const coding = {
  id: "coding",
  label: "Coding",
  components: [
    ...SHARED_COMPONENTS,
    {
      id: "tech_stack",
      required: true,
      ifMissing: "ask",
      present: "Does the prompt state the language, framework, versions or files involved?",
      score: "How specific is the stated tech stack?",
      examples: ["my website", "in JS", "React with Vite", "React 18 + Vite, src/auth/Login.tsx"],
    },
    {
      id: "acceptance",
      required: true,
      ifMissing: "infer",
      present: "Does the prompt state how to tell the task is done?",
      score: "How specific are the done criteria?",
      examples: [
        "make it work",
        "it should handle errors",
        "expired tokens show an error message",
        "existing tests pass; new test covers expired token",
      ],
    },
    {
      id: "current_state",
      required: false,
      ifMissing: "ask",
      present: "Does the prompt state the existing behaviour, error or code?",
      score: "How specific is the description of the current state?",
      examples: [
        "it's broken",
        "submit crashes",
        "submit throws a TypeError",
        "throws TypeError: x is undefined on submit; stack trace attached",
      ],
    },
  ],
  fixedConstraints: [],
  rubric: [
    { id: "correctness", judge: "exec", question: "Does the code pass the eval case's tests?" },
    {
      id: "context_fit",
      judge: "jev",
      question: "Does the output use the stack, files and conventions the prompt names, and respect its constraints?",
    },
    { id: "acceptance", judge: "jev", question: "Does the output address each done criterion stated in the prompt?" },
    {
      id: "minimal_change",
      judge: "jev",
      question: "Does the output change only what the task needs, with no unasked-for refactors or dependencies?",
    },
  ],
} as const satisfies ModeDef;
