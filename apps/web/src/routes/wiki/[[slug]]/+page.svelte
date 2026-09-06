<script lang="ts">
  import CodeBlock from "$lib/wiki/CodeBlock.svelte";
  import Playground from "$lib/wiki/Playground.svelte";
  let { data } = $props();
  const current = $derived(data.pages.findIndex((item) => item.slug === data.article.slug));
  const previous = $derived(data.pages[current - 1]);
  const next = $derived(data.pages[current + 1]);
  const metaTitle = $derived(data.article.slug ? `${data.article.title} · Jamlog wiki` : "Jamlog wiki");
</script>

<svelte:head>
  <title>{metaTitle}</title>
  <meta name="description" content={data.article.description} />
  <link rel="canonical" href={`https://fast.jamlog.lol${data.article.href}`} />
  <meta property="og:title" content={metaTitle} />
  <meta property="og:description" content={data.article.description} />
  <meta property="og:url" content={`https://fast.jamlog.lol${data.article.href}`} />
  <meta name="twitter:title" content={metaTitle} />
  <meta name="twitter:description" content={data.article.description} />
</svelte:head>

<div class:wiki-wide={data.article.slug === 'playground'} class="wiki-document">
  <article>
    <header class="wiki-page-header">
      <div class="wiki-eyebrow">Wiki <span>/</span> {data.article.group}</div>
      <h1>{data.article.title}</h1>
      <p>{data.article.description}</p>
    </header>
    {#if data.article.slug === ''}
      <a class="wiki-playground-callout" href="/wiki/playground">
        <span class="wiki-eyebrow">Interactive example</span>
        <strong>Try the widget playground</strong>
        <span>Preview the built-in themes and test CSS against the widget renderer.</span>
      </a>
    {/if}
    {#if data.article.slug === 'playground'}<Playground />{/if}
    <div class="wiki-prose">
      {#each data.blocks as block}
        {#if block.type === 'code'}<CodeBlock code={block.text} language={block.language} highlighted={block.highlighted} />{:else}{@html block.text}{/if}
      {/each}
    </div>
    <nav class="wiki-page-turn" aria-label="Adjacent pages">
      {#if previous}<a href={previous.href}><small>Previous</small>{previous.label}</a>{:else}<span></span>{/if}
      {#if next}<a href={next.href}><small>Next</small>{next.label}</a>{/if}
    </nav>
    <footer class="wiki-page-footer"><a class="wiki-external" href={`https://github.com/oyuh/music-widget/edit/master/wiki/${data.article.file}.md`} target="_blank" rel="noopener noreferrer">Edit this page <span aria-hidden="true">↗</span><span class="wiki-visually-hidden"> (opens in a new tab)</span></a><a class="wiki-external" href="https://github.com/oyuh/music-widget/issues/new" target="_blank" rel="noopener noreferrer">Report a problem <span aria-hidden="true">↗</span><span class="wiki-visually-hidden"> (opens in a new tab)</span></a></footer>
  </article>
  {#if data.headings.length && data.article.slug !== 'playground'}
    <aside class="wiki-toc"><nav aria-label="On this page"><p class="wiki-eyebrow">On this page</p>{#each data.headings as heading}<a href={`#${heading.id}`} class:sub={heading.depth > 2}>{heading.text}</a>{/each}</nav></aside>
  {/if}
</div>
