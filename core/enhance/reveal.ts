export type PartState = "queued" | "writing" | "waiting" | "shown";

type Slot = { readonly paragraph: number; text: string; done: boolean };

/** Join parts into paragraphs: same paragraph with a space, new paragraph with a blank line. */
export function assemble(parts: readonly { readonly paragraph: number; readonly text: string }[]): string {
  let output = "";
  let current: number | null = null;
  for (const { paragraph, text } of parts) {
    const clean = text.trim();
    if (!clean) continue;
    if (current === null) output = clean;
    else output += (paragraph === current ? " " : "\n\n") + clean;
    current = paragraph;
  }
  return output;
}

/**
 * Parts generate in parallel but appear strictly in order. The earliest unfinished part
 * streams; a later part that finishes first waits, then appears as soon as everything
 * before it is done.
 */
export class InOrderReveal {
  readonly #slots: Slot[];

  /** `staticText` non-null means the part is already complete. It still waits its turn to show. */
  constructor(parts: readonly { readonly paragraph: number; readonly staticText: string | null }[]) {
    this.#slots = parts.map((p) => ({ paragraph: p.paragraph, text: p.staticText ?? "", done: p.staticText !== null }));
  }

  append(index: number, delta: string): void {
    const slot = this.#slot(index);
    if (!slot.done) slot.text += delta;
  }

  /** Complete a part. The final text replaces anything streamed, e.g. when a guard rejects it. */
  finish(index: number, text: string): void {
    const slot = this.#slot(index);
    slot.text = text;
    slot.done = true;
  }

  /** How many leading parts are complete; the next one is the part allowed to stream. */
  get #front(): number {
    const first = this.#slots.findIndex((s) => !s.done);
    return first === -1 ? this.#slots.length : first;
  }

  /** The text the user should see right now. */
  text(): string {
    return assemble(this.#slots.slice(0, this.#front + 1));
  }

  states(): PartState[] {
    const front = this.#front;
    return this.#slots.map((slot, i) => {
      if (i < front) return "shown";
      if (slot.done) return "waiting";
      return slot.text ? "writing" : "queued";
    });
  }

  #slot(index: number): Slot {
    const slot = this.#slots[index];
    if (!slot) throw new RangeError(`No part at index ${index}.`);
    return slot;
  }
}
