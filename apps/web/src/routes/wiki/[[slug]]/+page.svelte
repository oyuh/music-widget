<script lang="ts">
  import CodeBlock from "$lib/wiki/CodeBlock.svelte";
  import Playground from "$lib/wiki/Playground.svelte";
  let { data } = $props();
  const current = $derived(data.pages.findIndex((item) => item.slug === data.article.slug));
  const previous = $derived(data.pages[current - 1]);
  const next = $derived(data.pages[current + 1]);
</script>

<svelte:head>
  <title>{data.article.title} · Jamlog wiki</title>
  <meta name="description" content={data.article.description} />
  <link rel="canonical" href={`https://fast.jamlog.lol${data.article.href}`} />
  <meta property="og:title" content={`${data.article.title} · Jamlog wiki`} />
  <meta property="og:description" content={data.article.description} />
  <meta property="og:url" content={`https://fast.jamlog.lol${data.article.href}`} />
  <meta name="twitter:title" content={`${data.article.title} · Jamlog wiki`} />
  <meta name="twitter:description" content={data.article.description} />
</svelte:head>

<div class:wiki-wide={data.article.slug === 'playground'} class="wiki-document">
  <article>
    <header class="wiki-page-header">
      <div class="wiki-eyebrow">Wiki <span>/</span> {data.article.group}</div>
      <h1>{data.article.title}<span class="wiki-title-dot">.</span></h1>
      <p>{data.article.description}</p>
    </header>
    {#if data.article.slug === ''}
      <a class="wiki-playground-callout canvas-checker" href="/wiki/playground">
        <span class="wiki-eyebrow">INTERACTIVE GUIDE</span>
        <strong>Try the widget playground <span>→</span></strong>
        <span>Move elements and edit CSS against the real widget renderer.</span>
        <span class="wiki-callout-diagram" aria-hidden="true"><span class="wiki-demo-cover">♫</span><span><b>Your favorite track</b><small>Your favorite artist</small><i></i></span><span class="wiki-demo-cursor">↖</span></span>
      </a>
    {/if}
    {#if data.article.slug === 'playground'}<Playground />{/if}
    <div class="wiki-prose">
      {#each data.blocks as block}
        {#if block.type === 'code'}<CodeBlock code={block.text} language={block.language} />{:else}{@html block.text}{/if}
      {/each}
    </div>
    <nav class="wiki-page-turn" aria-label="Adjacent pages">
      {#if previous}<a href={previous.href}><small>← Previous</small>{previous.label}</a>{:else}<span></span>{/if}
      {#if next}<a href={next.href}><small>Next →</small>{next.label}</a>{/if}
    </nav>
    <footer class="wiki-page-footer"><a href={`https://github.com/oyuh/music-widget/edit/master/wiki/${data.article.file}.md`}>Edit this page ↗</a><a href="https://github.com/oyuh/music-widget/issues/new">Report a problem ↗</a></footer>
  </article>
  {#if data.headings.length && data.article.slug !== 'playground'}
    <aside class="wiki-toc"><nav aria-label="On this page"><p class="wiki-eyebrow">On this page</p>{#each data.headings as heading}<a href={`#${heading.id}`} class:sub={heading.depth > 2}>{heading.text}</a>{/each}</nav></aside>
  {/if}
</div>
