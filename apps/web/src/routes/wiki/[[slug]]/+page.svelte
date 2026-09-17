<script lang="ts">
  import CodeBlock from "$lib/wiki/CodeBlock.svelte";
  import Playground from "$lib/wiki/Playground.svelte";
  import WikiPage from "$lib/wiki/WikiPage.svelte";
  import Icon from "$lib/ui/Icon.svelte";

  let { data } = $props();
  const playground = $derived(data.article.slug === "playground");
  const showToc = $derived(data.headings.length > 0 && !playground);
</script>

<WikiPage article={data.article} pages={data.pages} wide={playground} toc={showToc ? toc : undefined}>
  {#if data.article.slug === ""}
    <a class="wiki-callout" href="/wiki/playground">
      <Icon name="play" class="wiki-callout-icon" />
      <span>
        <span class="wiki-eyebrow">Interactive example</span>
        <strong>Try the widget playground</strong>
        <span class="wiki-callout-body">Preview the built-in themes and test CSS against the widget renderer.</span>
      </span>
    </a>
  {/if}

  {#if playground}<Playground />{/if}

  <div class="wiki-prose">
    {#each data.blocks as block}
      {#if block.type === "code"}
        <CodeBlock code={block.text} language={block.language} highlighted={block.highlighted} />
      {:else}{@html block.text}{/if}
    {/each}
  </div>
</WikiPage>

{#snippet toc()}
  <nav aria-label="On this page">
    <p class="wiki-eyebrow">On this page</p>
    {#each data.headings as heading}
      <a href={`#${heading.id}`} class:sub={heading.depth > 2}>{heading.text}</a>
    {/each}
  </nav>
{/snippet}
