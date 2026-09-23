<script lang="ts">
  import type { Snippet } from "svelte";
  import Icon from "$lib/ui/Icon.svelte";

  // The chrome every wiki page shares: head tags, the title block, the
  // previous/next pair and the footer links. Markdown articles and the two
  // Svelte-written legal pages both render through it, so they stay identical
  // apart from the body each one passes in.
  interface Entry {
    href: string;
    label: string;
  }
  interface Props {
    article: { href: string; title: string; description: string; group: string; icon: string };
    pages: Entry[];
    /** Drop the table of contents column and use the full width (the playground). */
    wide?: boolean;
    toc?: Snippet;
    children: Snippet;
  }
  let { article, pages, wide = false, toc, children }: Props = $props();

  const index = $derived(pages.findIndex((item) => item.href === article.href));
  const previous = $derived(index > 0 ? pages[index - 1] : undefined);
  const next = $derived(pages[index + 1]);
  const metaTitle = $derived(article.href === "/wiki" ? "Jamlog wiki" : `${article.title} · Jamlog wiki`);
  const url = $derived(`https://fast.jamlog.lol${article.href}`);
</script>

<svelte:head>
  <title>{metaTitle}</title>
  <meta name="description" content={article.description} />
  <link rel="canonical" href={url} />
  <meta property="og:title" content={metaTitle} />
  <meta property="og:description" content={article.description} />
  <meta property="og:url" content={url} />
  <meta name="twitter:title" content={metaTitle} />
  <meta name="twitter:description" content={article.description} />
</svelte:head>

<div class="wiki-document" class:wiki-wide={wide}>
  <article>
    <header class="wiki-page-header">
      <p class="wiki-eyebrow">
        <Icon name={article.icon} class="wiki-icon" />
        <span>Wiki</span><span class="wiki-eyebrow-slash">/</span><span>{article.group}</span>
      </p>
      <h1>{article.title}</h1>
      <p class="wiki-page-lede">{article.description}</p>
    </header>

    {@render children()}

    <nav class="wiki-page-turn" aria-label="Adjacent pages">
      {#if previous}
        <a href={previous.href}>
          <small>Previous</small>
          <span><Icon name="arrowLeft" class="wiki-icon" />{previous.label}</span>
        </a>
      {:else}<span></span>{/if}
      {#if next}
        <a href={next.href}>
          <small>Next</small>
          <span>{next.label}<Icon name="arrowRight" class="wiki-icon" /></span>
        </a>
      {/if}
    </nav>

    <footer class="wiki-page-footer">
      <a class="wiki-external" href="https://github.com/oyuh/music-widget/issues/new" target="_blank" rel="noopener noreferrer">
        <Icon name="alert" class="wiki-icon" />Report a problem
        <span aria-hidden="true">↗</span><span class="wiki-visually-hidden"> (opens in a new tab)</span>
      </a>
    </footer>
  </article>

  {#if toc}
    <aside class="wiki-toc">{@render toc()}</aside>
  {/if}
</div>
