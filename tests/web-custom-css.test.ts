import { test, expect, describe } from "bun:test";
import { CSS_MAX, customCssActive, defaultConfig, scopeCss } from "../apps/web/src/lib/config";
import { mergeConfig } from "../apps/web/src/lib/config-merge";

describe("scopeCss", () => {
  test("nests plain rules under the scope", () => {
    const out = scopeCss('[data-el="title"] { color: red; }', ".w");
    expect(out).toBe('.w{\n[data-el="title"] { color: red; }\n}');
  });

  test("hoists at-rules that can't live inside a style rule", () => {
    const out = scopeCss("@keyframes spin { to { rotate: 1turn; } } .a { color: red }", ".w");
    expect(out.startsWith("@keyframes spin { to { rotate: 1turn; } }")).toBe(true);
    expect(out).toContain(".w{\n.a { color: red }\n}");
    // The nested braces inside @keyframes must not split the block early.
    expect(out.match(/@keyframes/g)).toHaveLength(1);
  });

  test("drops @import so a shared widget can't pull a remote stylesheet", () => {
    expect(scopeCss('@import url("https://evil.example/x.css"); .a{color:red}', ".w")).toBe(
      ".w{\n.a{color:red}\n}",
    );
  });

  test("keeps a half-typed rule inside the scope", () => {
    expect(scopeCss(".a { color: re", ".w")).toBe(".w{\n.a { color: re\n}");
  });

  test("empty in, empty out", () => {
    expect(scopeCss("   ", ".w")).toBe("");
  });
});

describe("customCssActive", () => {
  test("needs both the flag and some actual CSS", () => {
    expect(customCssActive(defaultConfig)).toBe(false);
    expect(customCssActive({ ...defaultConfig, experimental: { enabled: false, css: ".a{}" } })).toBe(false);
    expect(customCssActive({ ...defaultConfig, experimental: { enabled: true, css: "  " } })).toBe(false);
    expect(customCssActive({ ...defaultConfig, experimental: { enabled: true, css: ".a{}" } })).toBe(true);
  });
});

describe("merge", () => {
  test("stays absent for configs that never opted in", () => {
    expect(mergeConfig({}).experimental).toBeUndefined();
  });

  test("normalizes what came out of a hand-edited hash", () => {
    const exp = mergeConfig({
      experimental: { enabled: 1, css: { nope: true } } as never,
    }).experimental!;
    expect(exp.enabled).toBe(true);
    expect(typeof exp.css).toBe("string");
  });

  test("caps the CSS so it can't bloat the widget URL without limit", () => {
    const exp = mergeConfig({ experimental: { enabled: true, css: "a".repeat(CSS_MAX * 2) } }).experimental!;
    expect(exp.css.length).toBe(CSS_MAX);
  });
});
