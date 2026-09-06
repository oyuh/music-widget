import { Marked, type Token } from "marked";
import hljs from "highlight.js/lib/core";
import css from "highlight.js/lib/languages/css";

hljs.registerLanguage("css", css);

function escapeAttribute(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function renderArticle(markdown: string) {
  const headings: { id: string; text: string; depth: number }[] = [];
  const blocks: { type: "html" | "code"; text: string; language?: string; highlighted?: string }[] = [];
  const ids = new Map<string, number>();
  const parser = new Marked({ renderer: {
    heading({ text, tokens, depth }) {
      if (depth === 1) return "";
      const base = text.toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");
      const count = ids.get(base) ?? 0;
      ids.set(base, count + 1);
      const id = count ? `${base}-${count}` : base;
      headings.push({ id, text, depth });
      return `<h${depth} id="${id}"><a href="#${id}">${this.parser.parseInline(tokens)}</a></h${depth}>`;
    },
    link({ href, title, tokens }) {
      const label = this.parser.parseInline(tokens);
      const titleAttribute = title ? ` title="${escapeAttribute(title)}"` : "";
      if (!/^https?:\/\//i.test(href)) return `<a href="${escapeAttribute(href)}"${titleAttribute}>${label}</a>`;
      return `<a class="wiki-external" href="${escapeAttribute(href)}"${titleAttribute} target="_blank" rel="noopener noreferrer">${label}<span aria-hidden="true"> ↗</span><span class="wiki-visually-hidden"> (opens in a new tab)</span></a>`;
    },
  } });
  let prose: Token[] = [];
  function flush() {
    if (prose.length) blocks.push({ type: "html", text: parser.parser(prose) });
    prose = [];
  }
  // Only repository-owned Markdown goes through this renderer.
  for (const token of parser.lexer(markdown)) {
    if (token.type === "code") {
      flush();
      const language = (token.lang || "text").split(/\s+/)[0].toLowerCase();
      const highlighted = hljs.getLanguage(language) ? hljs.highlight(token.text, { language }).value : undefined;
      blocks.push({ type: "code", text: token.text, language, highlighted });
    } else prose.push(token);
  }
  flush();
  return { headings, blocks };
}
