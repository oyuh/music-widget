import { pages } from "$lib/wiki/content";

export function load() {
  return { pages: pages.map(({ markdown, ...page }) => ({ ...page, search: markdown.toLowerCase() })) };
}
