<script lang="ts">
  import { onDestroy } from "svelte";

  let { code, language = "css", highlighted }: { code: string; language?: string; highlighted?: string } = $props();
  let copyLabel = $state("Copy code");
  let timer: ReturnType<typeof setTimeout> | undefined;

  async function copy() {
    clearTimeout(timer);
    try {
      await navigator.clipboard.writeText(code);
      copyLabel = "Copied";
    } catch {
      copyLabel = "Copy failed";
    }
    timer = setTimeout(() => copyLabel = "Copy code", 3000);
  }

  onDestroy(() => clearTimeout(timer));
</script>

<div class="wiki-code">
  <div class="wiki-code-bar">
    <span>{language}</span>
    <div>
      {#if language === "css"}<a href="/wiki/playground#css={encodeURIComponent(code)}">Try this CSS</a>{/if}
      <button class="wiki-copy-button" onclick={copy}><span aria-live="polite">{copyLabel}</span></button>
    </div>
  </div>
  <!-- Keyboard focus lets readers scroll long code lines without a pointer. -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <pre role="region" tabindex="0" aria-label={`${language} example`}>{#if highlighted}<code class={`hljs language-${language}`}>{@html highlighted}</code>{:else}<code>{code}</code>{/if}</pre>
</div>
