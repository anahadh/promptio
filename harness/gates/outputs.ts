import { appendFileSync } from "node:fs";

/** Writes key=value lines to $GITHUB_OUTPUT (no-op outside Actions). */
export function writeOutputs(values: Record<string, string>): void {
  const file = process.env.GITHUB_OUTPUT;
  if (!file) return;
  appendFileSync(file, Object.entries(values).map(([k, v]) => `${k}=${v.replace(/\n/g, " ")}\n`).join(""));
}

/** Appends Markdown to the run's step summary (no-op outside Actions). */
export function writeSummary(markdown: string): void {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (file) appendFileSync(file, `${markdown}\n`);
}
