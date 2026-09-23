import { groups, pages } from "$lib/wiki/content";

export function load() {
  return {
    groups,
    pages: pages.map(({ markdown, keywords, ...page }) => ({ ...page, search: `${keywords} ${markdown}`.toLowerCase() })),
  };
}
