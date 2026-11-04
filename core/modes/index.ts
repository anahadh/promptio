import type { ComponentDef, ModeDef, ModeId } from "../types";
import { analysis } from "./analysis";
import { coding } from "./coding";
import { ideas } from "./ideas";
import { learning } from "./learning";
import { research } from "./research";
import { writing } from "./writing";

/** Registry of all v1 modes. Keyed by ModeId, so a missing mode is a compile error. */
export const MODES: Readonly<Record<ModeId, ModeDef>> = {
  writing,
  coding,
  research,
  learning,
  analysis,
  ideas,
};

export function getMode(id: ModeId): ModeDef {
  return MODES[id];
}

export function getComponent(mode: ModeId, componentId: string): ComponentDef | undefined {
  return MODES[mode].components.find((c) => c.id === componentId);
}

export { SHARED_COMPONENTS } from "./shared";
