import { expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { renderArticle } from "../apps/web/src/lib/wiki/markdown";
import { demoConfig, recipes } from "../apps/web/src/lib/wiki/playground";
import { decodeConfig, encodeConfig } from "../apps/web/src/lib/config";

test("wiki links and section anchors resolve across the migrated Markdown", async () => {
  const articles = new Map<string, { markdown: string; ids: string[] }>();
  for (const file of await readdir("wiki")) {
    if (!file.endsWith(".md")) continue;
    const markdown = await readFile(`wiki/${file}`, "utf8");
    const slug = file === "Home.md" ? "" : `/${file.slice(0, -3).toLowerCase()}`;
    articles.set(`/wiki${slug}`, { markdown, ids: renderArticle(markdown).headings.map((h) => h.id) });
  }
  expect(articles.size).toBe(8);
  for (const [path, { markdown, ids }] of articles) {
    expect(markdown).not.toContain("github.com/oyuh/music-widget/wiki");
    for (const match of markdown.matchAll(/\]\((\/wiki[^)#]*|)(?:#([^)]*))?\)/g)) {
      const target = match[1] ? articles.get(match[1]) : { ids };
      expect(target, `${path}: ${match[0]}`).toBeDefined();
      if (match[2]) expect(target!.ids, `${path}: ${match[0]}`).toContain(match[2]);
    }
  }
});

test("article renderer highlights code, marks outbound links, and generates distinct section links", () => {
  const article = renderArticle('# Title\n\n## Color\n\n```css\n.a { color: red; }\n```\n\n## Color\n\nUse **red**. Read [setup](/wiki/getting-started) or [Last.fm](https://last.fm).');
  expect(article.headings.map((h) => h.id)).toEqual(["color", "color-1"]);
  const code = article.blocks.find((b) => b.type === "code");
  expect(code?.text).toBe(".a { color: red; }");
  expect(code?.highlighted).toContain("hljs-selector-class");
  const html = article.blocks.map((b) => b.text).join("");
  expect(html).toContain("<strong>red</strong>");
  expect(html).toContain('<a href="/wiki/getting-started">setup</a>');
  expect(html).toContain('href="https://last.fm" target="_blank" rel="noopener noreferrer"');
});

test("playground examples export without credentials", () => {
  const cfg = demoConfig();
  cfg.experimental = { enabled: true, css: recipes[0].css };
  const decoded = decodeConfig(encodeConfig(cfg))!;
  expect(decoded.experimental?.css).toBe(cfg.experimental?.css);
  expect(decoded.lfmUser).toBe("");
  expect(decoded.sessionKey).toBeFalsy();
  expect(decoded.apiKey).toBeFalsy();
  expect(new Set(recipes.map((recipe) => recipe.id)).size).toBe(recipes.length);
});
