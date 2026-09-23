import { error, redirect } from "@sveltejs/kit";
import { articles } from "$lib/wiki/content";
import { renderArticle } from "$lib/wiki/markdown";
import type { EntryGenerator, PageServerLoad } from "./$types";

export const entries: EntryGenerator = () => articles.map(({ slug }) => ({ slug }));

export const load: PageServerLoad = ({ params }) => {
  const slug = params.slug ?? "";
  const alias = articles.find((page) => page.file.toLowerCase() === slug.toLowerCase());
  if (alias && slug !== alias.slug) redirect(308, alias.href);
  const article = articles.find((page) => page.slug === slug);
  if (!article) error(404, "This wiki page doesn't exist.");
  const { markdown, keywords, ...metadata } = article;
  return { article: metadata, ...renderArticle(markdown) };
};
