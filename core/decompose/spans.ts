/** A verbatim excerpt located in the original prompt. [start, end) are character offsets. */
export type Span = { readonly text: string; readonly start: number; readonly end: number };

/**
 * Find an excerpt in the prompt. Exact match first; otherwise tolerate differences in
 * whitespace only (models sometimes collapse newlines). Anything else is rejected,
 * because reassembly (feature 04) must splice edits back at real offsets.
 */
export function locate(prompt: string, excerpt: string, from = 0): Span | null {
  const trimmed = excerpt.trim();
  if (!trimmed) return null;

  const exact = prompt.indexOf(trimmed, from);
  if (exact !== -1) return { text: trimmed, start: exact, end: exact + trimmed.length };

  const pattern = trimmed
    .split(/\s+/)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s+");
  const match = new RegExp(pattern, "g");
  match.lastIndex = from;
  const found = match.exec(prompt);
  if (!found) return null;
  return { text: found[0], start: found.index, end: found.index + found[0].length };
}

/**
 * Locate every excerpt for one component. Repeated excerpts move past earlier matches,
 * so two identical quotes map to two different places. Unmatched excerpts are returned
 * separately so callers can log them instead of silently trusting them.
 */
export function locateAll(prompt: string, excerpts: readonly string[]): { spans: Span[]; unmatched: string[] } {
  const spans: Span[] = [];
  const unmatched: string[] = [];
  const nextFrom = new Map<string, number>();

  for (const excerpt of excerpts) {
    const key = excerpt.trim();
    const span = locate(prompt, excerpt, nextFrom.get(key) ?? 0) ?? locate(prompt, excerpt);
    if (!span) {
      unmatched.push(excerpt);
      continue;
    }
    nextFrom.set(key, span.end);
    if (!spans.some((s) => s.start === span.start && s.end === span.end)) spans.push(span);
  }

  spans.sort((a, b) => a.start - b.start);
  return { spans, unmatched };
}
