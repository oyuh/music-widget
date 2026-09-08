import { describe, expect, test } from "bun:test";
import { matchesInspectorSearch } from "../apps/web/src/lib/inspector-search";

const opacity = { label: "Opacity", section: "Progress bar", terms: "fade transparency" };

describe("inspector search", () => {
  test("matches labels, sections, plain-language aliases, and small typos", () => {
    expect(matchesInspectorSearch(opacity, "opacity")).toBe(true);
    expect(matchesInspectorSearch(opacity, "progress fade")).toBe(true);
    expect(matchesInspectorSearch(opacity, "transparency")).toBe(true);
    expect(matchesInspectorSearch(opacity, "opasity")).toBe(true);
  });

  test("requires every search word to match", () => {
    expect(matchesInspectorSearch(opacity, "progress color")).toBe(false);
    expect(matchesInspectorSearch({ label: "Vertical position", section: "Position & size", terms: "y top bottom" }, "opasity")).toBe(false);
    expect(matchesInspectorSearch({ label: "Layer order", section: "Position & size", terms: "front behind" }, "font")).toBe(false);
  });
});
