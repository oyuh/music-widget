import { error, redirect } from "@sveltejs/kit";
import { pages } from "$lib/wiki/content";
import { renderArticle } from "$lib/wiki/markdown";
import type { EntryGenerator, PageServerLoad } from "./$types";

export const entries: EntryGenerator = () => pages.map(({ slug }) => ({ slug }));

export const load: PageServerLoad = ({ params }) => {
  const slug = params.slug ?? "";
  const alias = pages.find((page) => page.file.toLowerCase() === slug.toLowerCase());
  if (alias && slug !== alias.slug) redirect(308, alias.href);
  const article = pages.find((page) => page.slug === slug);
  if (!article) error(404, "This wiki page doesn't exist.");
  const { markdown, ...metadata } = article;
  return { article: metadata, ...renderArticle(markdown) };
};
