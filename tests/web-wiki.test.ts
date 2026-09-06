import { expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { renderArticle } from "../apps/web/src/lib/wiki/markdown";
import { demoConfig, moveElement } from "../apps/web/src/lib/wiki/playground";
import { decodeConfig, encodeConfig } from "../apps/web/src/lib/config";

test("wiki links and section anchors resolve across the migrated Markdown", async () => {
  const articles = new Map<string, { markdown: string; ids: string[] }>();
  for (const file of await readdir("wiki")) {
    if (!file.endsWith(".md")) continue;
    const markdown = await readFile(`wiki/${file}`, "utf8");
    const slug = file === "Home.md" ? "" : `/${file.slice(0, -3).toLowerCase()}`;
    articles.set(`/wiki${slug}`, { markdown, ids: renderArticle(markdown).headings.map((h) => h.id) });
  }
  expect(articles.size).toBe(7);
  for (const [path, { markdown, ids }] of articles) {
    expect(markdown).not.toContain("github.com/oyuh/music-widget/wiki");
    for (const match of markdown.matchAll(/\]\((\/wiki[^)#]*|)(?:#([^)]*))?\)/g)) {
      const target = match[1] ? articles.get(match[1]) : { ids };
      expect(target, `${path}: ${match[0]}`).toBeDefined();
      if (match[2]) expect(target!.ids, `${path}: ${match[0]}`).toContain(match[2]);
    }
  }
});

test("article renderer preserves code and generates distinct section links", () => {
  const article = renderArticle('# Title\n\n## Color\n\n```css\n.a { color: red; }\n```\n\n## Color\n\nUse **red**.');
  expect(article.headings.map((h) => h.id)).toEqual(["color", "color-1"]);
  expect(article.blocks.find((b) => b.type === "code")?.text).toBe(".a { color: red; }");
  expect(article.blocks.map((b) => b.text).join("")).toContain("<strong>red</strong>");
});

test("playground clamps moves, rejects invalid positions, and exports the design without credentials", () => {
  const cfg = demoConfig();
  moveElement(cfg, "art", -30, 900);
  expect([cfg.v2!.elements.art.x, cfg.v2!.elements.art.y]).toEqual([0, 72]);
  moveElement(cfg, "art", NaN, Infinity);
  expect(cfg.v2!.elements.art.x).toBe(0);
  moveElement(cfg, "background", 30, 30);
  expect(cfg.v2!.elements.background.x).toBe(0);
  const decoded = decodeConfig(encodeConfig(cfg))!;
  expect(decoded.experimental?.css).toBe(cfg.experimental?.css);
  expect(decoded.lfmUser).toBe("");
  expect(decoded.sessionKey).toBeFalsy();
  expect(decoded.apiKey).toBeFalsy();
  expect(demoConfig().v2!.elements.art.x).toBe(20);
});
