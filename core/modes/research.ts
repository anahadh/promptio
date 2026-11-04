import type { ModeDef } from "../types";
import { SHARED_COMPONENTS } from "./shared";

export const research = {
  id: "research",
  label: "Research",
  components: [
    ...SHARED_COMPONENTS,
    {
      id: "scope",
      required: true,
      ifMissing: "ask",
      present: "Does the prompt state the boundaries of the research, such as time, place or depth?",
      score: "How specific are the research boundaries?",
      examples: ["about EVs", "EV sales trends", "US EV sales in recent years", "US EV sales 2020-2025, broken down by maker"],
    },
    {
      id: "sources",
      required: true,
      ifMissing: "infer",
      present: "Does the prompt state which sources count, or whether to cite them?",
      score: "How specific are the source requirements?",
      examples: [
        "look it up",
        "reliable sources",
        "use official statistics",
        "government or peer-reviewed data; cite each claim",
      ],
    },
  ],
  fixedConstraints: [],
  rubric: [
    { id: "citations", judge: "jev", question: "Does every factual claim in the output have a citation?" },
    { id: "source_type", judge: "jev", question: "Are the cited sources the kind the prompt asked for?" },
    { id: "scope_fit", judge: "jev", question: "Does the output stay within the time, place and depth the prompt sets?" },
    { id: "uncertainty", judge: "jev", question: "Does the output flag what is unknown, disputed or weakly supported?" },
  ],
} as const satisfies ModeDef;
