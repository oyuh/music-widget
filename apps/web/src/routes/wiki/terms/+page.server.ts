import { legalPages } from "$lib/wiki/content";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = () => {
  const { markdown, keywords, ...article } = legalPages.find((page) => page.slug === "terms")!;
  return { article };
};
