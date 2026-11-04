import type { ModeDef } from "../types";
import { SHARED_COMPONENTS } from "./shared";

export const writing = {
  id: "writing",
  label: "Writing",
  components: [
    ...SHARED_COMPONENTS,
    {
      id: "audience",
      required: true,
      ifMissing: "ask",
      present: "Does the prompt state who will read the text?",
      score: "How specific is the stated reader?",
      examples: [
        "people",
        "recruiters",
        "a hiring manager at a startup",
        "a hiring manager at a fintech startup hiring backend engineers",
      ],
    },
    {
      id: "key_points",
      required: true,
      ifMissing: "ask",
      present: "Does the prompt state what the text must say?",
      score: "How specific are the points the text must make?",
      examples: [
        "about our launch",
        "announce the launch and a discount",
        "launch in March, discount, waitlist",
        "launches Mar 3, 20% off, waitlist link",
      ],
    },
    {
      id: "tone",
      required: true,
      ifMissing: "ask",
      present: "Does the prompt state the voice or tone of the text?",
      score: "How specific is the requested tone?",
      examples: ["make it good", "professional", "warm but direct", "warm but direct, no jargon, peer to peer"],
    },
    {
      id: "source_text",
      required: false,
      ifMissing: "ask",
      present: "Does the prompt include a draft or notes to work from?",
      score: "How complete is the provided draft or notes?",
      examples: [
        "my essay (not pasted)",
        "a one-line summary of the draft",
        "most of the draft pasted",
        "the full 400-word draft pasted",
      ],
    },
  ],
  fixedConstraints: [
    "No filler openers or closers (e.g. 'Certainly!', 'I hope this helps').",
    "No stock AI phrasing (e.g. 'delve', 'in today's fast-paced world', 'it's important to note').",
    "No summary unless one is asked for.",
  ],
  rubric: [
    { id: "audience_fit", judge: "jev", question: "Does the output match the audience the prompt names?" },
    {
      id: "coverage",
      judge: "jev",
      question: "Does the output include every key point stated in the prompt and add no facts that aren't there?",
    },
    { id: "tone", judge: "jev", question: "Does the output match the tone the prompt asks for, without stock AI phrasing?" },
    { id: "economy", judge: "jev", question: "Is the output free of filler, and does it follow the requested length or format?" },
  ],
} as const satisfies ModeDef;
