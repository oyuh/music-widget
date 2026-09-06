import { Marked, type Token } from "marked";

export function renderArticle(markdown: string) {
  const headings: { id: string; text: string; depth: number }[] = [];
  const blocks: { type: "html" | "code"; text: string; language?: string }[] = [];
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
      blocks.push({ type: "code", text: token.text, language: token.lang || "text" });
    } else prose.push(token);
  }
  flush();
  return { headings, blocks };
}
