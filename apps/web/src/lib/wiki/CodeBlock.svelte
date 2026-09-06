<script lang="ts">
  let { code, language = "css" }: { code: string; language?: string } = $props();
  let message = $state("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      message = "Copied";
    } catch {
      message = "Select the code and copy it manually.";
    }
  }
</script>

<div class="wiki-code">
  <div class="wiki-code-bar">
    <span>{language}</span>
    <div>
      {#if language === "css"}<a href="/wiki/playground#css={encodeURIComponent(code)}">Try this CSS ↗</a>{/if}
      <button onclick={copy}>Copy code</button>
    </div>
  </div>
  <!-- Keyboard focus lets readers scroll long code lines without a pointer. -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <pre role="region" tabindex="0" aria-label={`${language} example`}><code>{code}</code></pre>
  {#if message}<p class="wiki-copy-status" role="status">{message}</p>{/if}
</div>
