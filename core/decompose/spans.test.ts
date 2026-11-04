import { describe, expect, it } from "vitest";
import { locate, locateAll } from "./spans";

const prompt = "Fix the login in my React 18 app.\nIt throws a TypeError on submit.";

describe("locate", () => {
  it("finds an exact excerpt with its offsets", () => {
    const span = locate(prompt, "React 18 app");
    expect(span).toEqual({ text: "React 18 app", start: prompt.indexOf("React"), end: prompt.indexOf("React") + 12 });
  });

  it("tolerates whitespace differences only", () => {
    const span = locate(prompt, "React 18 app. It throws");
    expect(span?.text).toBe("React 18 app.\nIt throws");
  });

  it("rejects paraphrases and typo fixes", () => {
    expect(locate(prompt, "Fix the log-in")).toBeNull();
    expect(locate(prompt, "react 18 app")).toBeNull();
  });

  it("treats regex characters literally", () => {
    expect(locate("cost (USD) > $5?", "(USD) > $5?")).not.toBeNull();
  });

  it("ignores empty excerpts", () => {
    expect(locate(prompt, "   ")).toBeNull();
  });
});

describe("locateAll", () => {
  it("returns spans in prompt order and reports unmatched excerpts", () => {
    const { spans, unmatched } = locateAll(prompt, ["TypeError on submit", "Fix the login", "made up text"]);
    expect(spans.map((s) => s.text)).toEqual(["Fix the login", "TypeError on submit"]);
    expect(unmatched).toEqual(["made up text"]);
  });

  it("maps a repeated excerpt to its next occurrence", () => {
    const { spans } = locateAll("use tests. then use tests.", ["use tests", "use tests"]);
    expect(spans.map((s) => s.start)).toEqual([0, 16]);
  });

  it("dedupes the same span", () => {
    const { spans } = locateAll("only once", ["only once", "only once"]);
    expect(spans).toHaveLength(1);
  });
});
