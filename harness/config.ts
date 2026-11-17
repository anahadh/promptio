import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { z } from "zod";
import { TASK_TYPES, type TaskType } from "./types";

const taskType = z.enum(TASK_TYPES);
const model = z.enum(["haiku", "sonnet", "opus"]);
const nonEmpty = z.string().min(1);

const ConfigSchema = z
  .object({
    project: nonEmpty,
    harness_version: z.string().regex(/^\d+\.\d+\.\d+$/),
    phase: nonEmpty,
    min_tests_for_auto_merge: z.number().int().min(0),
    checks: z.array(nonEmpty).min(1),
    setup: nonEmpty,
    intake: nonEmpty,
    semantic: z.array(nonEmpty),
    auto_merge: z.array(taskType),
    pr_only: z.array(taskType),
    plan_only: z.array(taskType),
    ladder: z.partialRecord(taskType, z.array(model).min(1)),
    protected_paths: z.array(nonEmpty),
    max_tasks_per_night: z.number().int().min(0),
    max_features_per_night: z.number().int().min(0),
    max_diff_lines: z.number().int().positive(),
    budget_usd_month: z.number().nonnegative(),
  })
  .strict()
  .superRefine((cfg, ctx) => {
    const seen = new Map<TaskType, string>();
    for (const list of ["auto_merge", "pr_only", "plan_only"] as const) {
      for (const t of cfg[list]) {
        const prev = seen.get(t);
        if (prev) ctx.addIssue({ code: "custom", path: [list], message: `"${t}" is also in ${prev}` });
        seen.set(t, list);
      }
    }
    if (cfg.max_features_per_night > cfg.max_tasks_per_night) {
      ctx.addIssue({ code: "custom", path: ["max_features_per_night"], message: "must not exceed max_tasks_per_night" });
    }
    // Every type the routine can work on needs a model ladder; plan-only types never run.
    for (const t of [...cfg.auto_merge, ...cfg.pr_only]) {
      if (!cfg.ladder[t]) ctx.addIssue({ code: "custom", path: ["ladder"], message: `no ladder for "${t}"` });
    }
  });

export type HarnessConfig = z.infer<typeof ConfigSchema>;

export class ConfigError extends Error {
  override name = "ConfigError";
}

/** Parses and validates config YAML. Throws ConfigError naming every bad field. */
export function parseConfig(yamlText: string): HarnessConfig {
  let raw: unknown;
  try {
    raw = parse(yamlText);
  } catch (e) {
    throw new ConfigError(`invalid YAML: ${(e as Error).message}`);
  }
  const result = ConfigSchema.safeParse(raw);
  if (result.success) return result.data;
  const lines = result.error.issues.map((i) => {
    const keys = i.code === "unrecognized_keys" ? `: ${i.keys.join(", ")}` : "";
    return `  ${i.path.join(".") || "(root)"}: ${i.message}${keys}`;
  });
  throw new ConfigError(`invalid harness config:\n${lines.join("\n")}`);
}

export function loadConfig(path = "harness.config.yaml"): HarnessConfig {
  try {
    return parseConfig(readFileSync(path, "utf8"));
  } catch (e) {
    throw new ConfigError(`${path}: ${(e as Error).message}`);
  }
}

/** The loop runs only in the solo-dev phase (spec section 15). */
export function isLoopActive(cfg: HarnessConfig): boolean {
  return cfg.phase === "solo-dev";
}
