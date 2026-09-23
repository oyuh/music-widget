<script lang="ts">
  import { tip } from "$lib/ui/tooltip.svelte";
  import { ELEMENTS, freshConfig, labelFor, type EditorState } from "$lib/editor.svelte";
  import { PRESETS } from "$lib/presets";
  import ConfirmButton from "$lib/ui/ConfirmButton.svelte";
  import Collapsible from "$lib/ui/Collapsible.svelte";
  import InfoTip from "$lib/ui/InfoTip.svelte";
  import { ICONS } from "$lib/ui/icons";
  import SidebarFooter from "$lib/editor/SidebarFooter.svelte";
  import ClipboardText from "$lib/ui/ClipboardText.svelte";

  import { LASTFM_TIMING_HINT, LASTFM_PAUSE_HINT } from "$lib/lastfm-hints";
  import { CSS_DOCS, CSS_MAX, CSS_SCOPE, isBaseId, MAX_PER_KIND } from "$lib/config";
  import { recordWidgetCopy } from "$lib/usage";

  // Collapsible sections (collapsed by default to declutter; the Last.fm,
  // Share, Elements and status sections always stay open).
  let importOpen = $state(false);
  let presetsOpen = $state(false);
  let myPresetsOpen = $state(false);

  interface Props {
    editor: EditorState;
  }
  let { editor }: Props = $props();

  let setupOpen = $state(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  // Recomputes whenever the config changes (exportHash reads it).
  const shareUrl = $derived(`${origin}/w#${editor.exportHash()}`);

  function onUserInput() {
    editor.save();
  }

  let importText = $state("");
  let importMsg = $state("");
  let importOk = $state(false);

  function doImport() {
    importOk = editor.importConfig(importText);
    importMsg = importOk ? "Imported settings!" : "Couldn't read that link / code.";
    if (importOk) importText = "";
    setTimeout(() => (importMsg = ""), 2500);
  }

  let newPresetName = $state("");
  let copiedPresetId = $state<string | null>(null);

  function savePreset() {
    editor.saveCurrentAsPreset(newPresetName);
    newPresetName = "";
  }

  async function copyPresetLink(id: string) {
    try {
      await navigator.clipboard.writeText(editor.presetShareUrl(id));
      copiedPresetId = id;
      setTimeout(() => {
        if (copiedPresetId === id) copiedPresetId = null;
      }, 1500);
    } catch {
      /* ignore */
    }
  }

  const pillCls = "rounded border border-border px-1.5 py-0.5 text-[11px] transition hover:bg-muted";

  // Borderless glyph buttons on the element rows: same treatment as the canvas
  // toolbar, so the row reads as one line instead of a strip of little boxes.
  const rowAdd =
    "flex h-6 w-6 shrink-0 items-center justify-center rounded text-base leading-none text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-muted-foreground";
  const rowDel =
    "flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground transition hover:bg-muted hover:text-red-400";

  // The pause symbol only renders in "Show paused" mode, so dim + disable its row
  // when the widget is set to hide entirely while paused (nothing to style there).
  const pauseInactive = $derived((editor.config.fields.pausedMode ?? "label") !== "label");

  // ---- Account (private profile sign-in + your own API key) ----
  let accountOpen = $state(false);
  const accountActive = $derived(!!editor.sessionName || !!editor.config.apiKey);
  const accountTip = $derived(
    editor.sessionName && editor.config.apiKey
      ? `Signed in as ${editor.sessionName} · using your own API key`
      : editor.sessionName
        ? `Signed in as ${editor.sessionName}`
        : editor.config.apiKey
          ? "Using your own API key"
          : "Private profile? Sign in, or use your own API key",
  );

  // The wordmark, split so each letter reacts to the pointer on its own.
  const WORDMARK = [..."fast.jamlog.lol"];

  // ---- Experimental: custom CSS ----
  let experimentalOpen = $state(false);
  let cssOpen = $state(true);
  const cssOn = $derived(!!editor.config.experimental?.enabled);
  const cssText = $derived(editor.config.experimental?.css ?? "");

  function setCss(v: string) {
    const exp = editor.config.experimental;
    if (!exp) return;
    exp.css = v.slice(0, CSS_MAX);
    editor.save();
  }

  /**
   * Dump what the widget is actually rendering right now as CSS. Every style the
   * normal settings produce is inline, so this reads them straight off the live
   * preview: it's a real starting point rather than a guess at what's applied.
   */
  function loadCurrentStyles() {
    const root = document.querySelector(`.${CSS_SCOPE}`);
    if (!root) return;
    const rules: string[] = [];
    const push = (sel: string, node: Element) => {
      const decls = (node.getAttribute("style") ?? "")
        .split(";")
        .map((d) => d.trim())
        .filter(Boolean);
      if (decls.length) rules.push(`${sel} {\n${decls.map((d) => `  ${d};`).join("\n")}\n}`);
    };
    for (const node of root.querySelectorAll("[data-el]")) {
      const sel = `[data-el="${node.getAttribute("data-el")}"]`;
      push(sel, node);
      // The wrapper carries position/size; the child carries the paint (font,
      // color, the progress fill), which is usually what people came here for.
      const kids = Array.from(node.children);
      kids.forEach((k, i) => {
        push(kids.length === 1 ? `${sel} > ${k.tagName.toLowerCase()}` : `${sel} > :nth-child(${i + 1})`, k);
      });
    }
    const header =
      "/* Your widget as it looks right now. Edit, delete, add whatever.\n" +
      "   These same values get re-applied inline whenever you touch a setting,\n" +
      "   so add !important to any rule you want to keep winning. */\n\n";
    setCss(header + rules.join("\n\n"));
  }

  // ---- Dev tools (local dev server only; stripped from production builds) ----
  const isDev = import.meta.env.DEV;
  let devJsonOpen = $state(false);
  let devJsonText = $state("");
  let devJsonError = $state("");
  let devCopied = $state(false);

  async function copyDevJson() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(editor.config, null, 2));
      devCopied = true;
      setTimeout(() => (devCopied = false), 1500);
    } catch {
      /* ignore */
    }
  }

  function openDevJson() {
    devJsonText = JSON.stringify(editor.config, null, 2);
    devJsonError = "";
    devJsonOpen = true;
  }

  function applyDevJson() {
    try {
      // Applied verbatim (no user/session preservation); dev edits should be literal.
      editor.config = freshConfig(JSON.parse(devJsonText));
      editor.save();
      devJsonOpen = false;
    } catch (e) {
      devJsonError = e instanceof Error ? e.message : String(e);
    }
  }
</script>

<!-- *:shrink-0 keeps sections at natural height so overflow scrolls instead of squishing them -->
<div class="flex h-full flex-col gap-4 overflow-y-auto p-3 text-sm *:shrink-0">
  <!-- Rules on either side stretch with the sidebar. -->
  <div class="flex items-center gap-3 pt-1">
    <div class="flex-1 border-t border-border" aria-hidden="true"></div>
    <div class="wordmark font-mono-ui text-xs font-medium tracking-[0.06em]">
      <span class="sr-only">fast.jamlog.lol</span>
      {#each WORDMARK as ch, i (i)}<span aria-hidden="true">{ch}</span>{/each}
    </div>
    <div class="flex-1 border-t border-border" aria-hidden="true"></div>
  </div>

  <!-- Last.fm account -->
  <section class="flex flex-col gap-2">
    <label for="lfm-user" class="font-mono-ui text-xs font-medium text-muted-foreground uppercase">Last.fm username</label>
    <div class="flex gap-2">
      <input
        id="lfm-user"
        type="text"
        placeholder="username"
        bind:value={editor.config.lfmUser}
        oninput={onUserInput}
        spellcheck="false"
        autocomplete="off"
        class="h-9 min-w-0 flex-1 rounded-md border border-border bg-zinc-800 px-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      />
      <button
        type="button"
        onclick={() => (accountOpen = true)}
        use:tip={accountTip}
        aria-label="Last.fm access: {accountTip}"
        aria-haspopup="dialog"
        class="relative grid h-9 w-9 shrink-0 place-items-center rounded-md border transition-colors before:absolute before:-inset-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 {accountActive
          ? 'border-border bg-zinc-800 text-green-400 hover:bg-muted'
          : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'}"
      >
        <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <!-- eslint-disable-next-line svelte/no-at-html-tags -- static, authored markup -->
          {@html ICONS.lock}
        </svg>
      </button>
    </div>
  </section>

  <!-- Share: the link itself, click to select it all, or hit the copy button. -->
  <section class="flex flex-col gap-1.5">
    <div class="font-mono-ui text-xs font-medium text-muted-foreground uppercase">Widget link</div>
    <ClipboardText text={shareUrl} label="widget link" oncopy={() => recordWidgetCopy(editor.config.lfmUser ?? "")} />
    <button
      type="button"
      onclick={() => (setupOpen = true)}
      class="self-center rounded px-1 py-1 text-[11px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
    >
      How do I add it to OBS?
    </button>
  </section>

  <div class="border-t border-border" role="separator"></div>

  <!-- Import -->
  <Collapsible title="Import" bind:open={importOpen}>
    <input
      type="text"
      bind:value={importText}
      placeholder="paste a /w link or base64"
      spellcheck="false"
      onkeydown={(e) => e.key === "Enter" && doImport()}
      class="w-full rounded-md border border-border bg-zinc-800 px-2 py-1.5 text-xs"
    />
    <button
      type="button"
      onclick={doImport}
      disabled={!importText.trim()}
      class="rounded-md border border-border px-2 py-1.5 text-xs hover:bg-muted disabled:opacity-40"
    >
      Import settings
    </button>
    {#if importMsg}
      <p class="text-[11px] {importOk ? 'text-green-400' : 'text-destructive'}">{importMsg}</p>
    {/if}
  </Collapsible>

  <!-- Custom CSS (experimental; only here once it's switched on) -->
  {#if cssOn}
    <Collapsible title="Custom CSS" bind:open={cssOpen} badge="{cssText.length}/{CSS_MAX}">
      <textarea
        value={cssText}
        oninput={(e) => setCss(e.currentTarget.value)}
        spellcheck="false"
        rows="14"
        placeholder={'[data-el="title"] > div {\n  color: hotpink !important;\n}'}
        class="w-full resize-y rounded-md border border-border bg-zinc-800 px-2 py-1.5 font-mono text-[11px] leading-relaxed"
      ></textarea>
      <div class="flex gap-2">
        <button
          type="button"
          onclick={loadCurrentStyles}
          use:tip={"Replace the box with your widget's current styles"}
          class="flex-1 rounded-md border border-border px-2 py-1.5 text-xs hover:bg-muted"
        >
          Load current styles
        </button>
        <ConfirmButton
          label="Clear"
          confirmLabel="Clear?"
          class="rounded-md border border-border px-2 py-1.5 text-xs text-red-400 hover:bg-muted"
          onconfirm={() => setCss("")}
        />
      </div>
      <p class="text-[11px] leading-snug text-muted-foreground">
        Scoped to your widget, so it can't touch the editor. Settings render as inline styles and
        beat plain rules, so use <code>!important</code> to win.
        <a class="text-primary underline" href={CSS_DOCS} target="_blank" rel="noopener noreferrer">
          Selectors &amp; examples →
        </a>
      </p>
      <button
        type="button"
        onclick={() => (experimentalOpen = true)}
        class="text-left text-[11px] text-amber-500/80 hover:text-amber-500"
      >
        Experimental feature · turn it off →
      </button>
    </Collapsible>
  {/if}

  {#if isDev}
    <!-- Dev tools (never rendered in production builds) -->
    <section class="flex flex-col gap-2 rounded-md border border-dashed border-amber-500/40 p-2">
      <div class="font-mono-ui text-xs font-medium text-amber-500/80 uppercase">Dev</div>
      <div class="flex gap-2">
        <button
          type="button"
          onclick={copyDevJson}
          class="flex-1 rounded-md border border-border px-2 py-1.5 text-xs hover:bg-muted"
        >
          {devCopied ? "Copied!" : "Copy JSON"}
        </button>
        <button
          type="button"
          onclick={openDevJson}
          class="flex-1 rounded-md border border-border px-2 py-1.5 text-xs hover:bg-muted"
        >
          Edit JSON
        </button>
      </div>
    </section>
  {/if}

  <!-- Presets -->
  <Collapsible title="Presets" bind:open={presetsOpen}>
    <div class="grid grid-cols-2 gap-2">
      {#each PRESETS as p (p.name)}
        <button
          type="button"
          onclick={() => editor.applyPreset(p.config)}
          class="rounded-md border border-border px-2 py-2 text-xs hover:bg-muted"
        >
          {p.name}
        </button>
      {/each}
    </div>
    <button
      type="button"
      onclick={() => editor.reset()}
      class="rounded-md border border-border px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted"
    >
      Reset to default
    </button>
  </Collapsible>

  <!-- Saved presets -->
  <Collapsible title="My Presets" bind:open={myPresetsOpen} badge="{editor.customPresets.length}/10">
    <div class="flex gap-2">
      <input
        type="text"
        bind:value={newPresetName}
        placeholder="preset name"
        maxlength="24"
        spellcheck="false"
        class="min-w-0 flex-1 rounded-md border border-border bg-zinc-800 px-2 py-1 text-xs"
      />
      <button
        type="button"
        onclick={savePreset}
        disabled={!editor.canSavePreset}
        use:tip={editor.canSavePreset ? "Save current look" : "Limit of 10 reached"}
        class="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-40"
      >
        Save
      </button>
    </div>

    {#each editor.customPresets as p (p.id)}
      <div class="rounded-md border border-border p-2">
        <div class="mb-1.5 truncate text-xs font-medium" use:tip={p.name}>{p.name}</div>
        <div class="flex flex-wrap gap-1">
          <ConfirmButton
            label="Apply"
            confirmLabel="Apply?"
            class={pillCls}
            onconfirm={() => editor.applyCustomPreset(p.id)}
          />
          <ConfirmButton
            label="Override"
            confirmLabel="Override?"
            class={pillCls}
            onconfirm={() => editor.overridePreset(p.id)}
          />
          <ConfirmButton
            label="Delete"
            confirmLabel="Delete?"
            class="{pillCls} text-red-400"
            onconfirm={() => editor.deletePreset(p.id)}
          />
          <button type="button" onclick={() => copyPresetLink(p.id)} class={pillCls}>
            {copiedPresetId === p.id ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>
    {/each}

    {#if editor.customPresets.length === 0}
      <p class="text-[11px] text-muted-foreground">Save the current look to reuse it later.</p>
    {/if}
  </Collapsible>

  <!-- Element list. Each kind lists its instances; the "+" copies the one you're
       looking at, up to MAX_PER_KIND. The first instance can't be deleted (hide
       it instead), so a design always has a background, a title and so on. -->
  <section class="flex flex-col gap-1">
    <div class="flex items-center gap-1 font-mono-ui text-xs font-medium text-muted-foreground uppercase">
      Elements
      <InfoTip
        text="Need two of something? Hit + to copy an element. You get up to {MAX_PER_KIND} of each, and every copy has its own position, color, size and font. Handy for a second background you can set to black and fade, so a blurred cover stops washing out your text."
        label="Elements"
      />
    </div>
    {#each ELEMENTS as kind (kind.id)}
      {@const inactive = kind.id === "pause" && pauseInactive}
      {@const ids = editor.idsOf(kind.id)}
      {#each ids as id (id)}
        <div class="flex items-center gap-1">
          <button
            type="button"
            disabled={inactive}
            use:tip={inactive
              ? "Hidden right now: the widget is set to hide entirely while paused. Switch to 'Show paused' in the Background settings at the bottom to use it."
              : ""}
            onclick={() => editor.select(id)}
            class="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors {editor.selected ===
            id
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-muted'} {inactive ? 'cursor-not-allowed opacity-40 hover:bg-transparent' : ''}"
          >
            <span class="w-4 shrink-0 text-center opacity-70">{kind.icon}</span>
            <span class="truncate">{labelFor(id)}</span>
            {#if !editor.el(id).visible && id !== "background"}
              <span class="ml-auto shrink-0 text-[10px] opacity-60">hidden</span>
            {/if}
          </button>

          {#if !isBaseId(id)}
            <!-- Click once to arm, again to delete: the can goes red and flashes
                 while it's waiting for that second click. -->
            <ConfirmButton
              title="Remove this one"
              confirmTitle="Click again to delete it"
              class={rowDel}
              armedClass="text-red-500 animate-pulse"
              onconfirm={() => editor.removeInstance(id)}
            >
              {#snippet children(armed: boolean)}
                <svg
                  viewBox="0 0 24 24"
                  class="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  stroke-width={armed ? 2.4 : 1.75}
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-label={armed ? "Delete this one?" : "Remove this one"}
                  role="img"
                >
                  <!-- eslint-disable-next-line svelte/no-at-html-tags -- static, authored markup -->
                  {@html ICONS.trash}
                </svg>
              {/snippet}
            </ConfirmButton>
          {/if}

          <!-- The + stays on the FIRST instance: it's the original, and the copies
               hanging under it each carry their own delete instead. -->
          {#if isBaseId(id)}
            <button
              type="button"
              disabled={inactive || !editor.canAdd(kind.id)}
              onclick={() => editor.duplicate(id)}
              use:tip={editor.canAdd(kind.id)
                ? `Add another ${kind.label.toLowerCase()} (copies this one)`
                : `You can have up to ${MAX_PER_KIND} of these`}
              aria-label="Add another {kind.label}"
              class={rowAdd}
            >
              +
            </button>
          {/if}

          {#if (kind.id === "progress" || kind.id === "duration" || kind.id === "pause") && isBaseId(id)}
            <InfoTip text={kind.id === "pause" ? LASTFM_PAUSE_HINT : LASTFM_TIMING_HINT} label={kind.label} />
          {/if}
        </div>
      {/each}
    {/each}
  </section>

  <!-- Sidebar footer -->
  <footer class="font-mono-ui mt-auto border-t border-border pt-3 text-[11px] leading-relaxed text-muted-foreground">
    <SidebarFooter lfmUser={editor.config.lfmUser} />
  </footer>
</div>

{#if accountOpen}
  {#await import("$lib/editor/AccountModal.svelte") then M}
    <M.default bind:open={accountOpen} {editor} />
  {/await}
{/if}

{#if isDev && devJsonOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    onclick={() => (devJsonOpen = false)}
    role="presentation"
  >
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div
      class="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-lg border border-border bg-card p-4 text-card-foreground"
      onclick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <h2 class="text-base font-semibold tracking-tight">Edit config JSON</h2>
      <p class="mt-1 text-xs text-muted-foreground">
        Dev only. Applied verbatim through <code>freshConfig</code> (defaults filled, v2-migrated), then saved.
      </p>
      <textarea
        bind:value={devJsonText}
        spellcheck="false"
        rows="20"
        class="mt-3 min-h-0 flex-1 resize-none rounded-md border border-border bg-zinc-800 px-2 py-1.5 font-mono text-xs leading-relaxed"
      ></textarea>
      {#if devJsonError}
        <p class="mt-2 text-[11px] text-destructive">{devJsonError}</p>
      {/if}
      <div class="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onclick={() => (devJsonOpen = false)}
          class="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted"
        >
          Cancel
        </button>
        <button
          type="button"
          onclick={applyDevJson}
          class="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
        >
          Apply
        </button>
      </div>
    </div>
  </div>
{/if}

{#if experimentalOpen}
  {#await import("$lib/editor/ExperimentalModal.svelte") then M}
    <M.default bind:open={experimentalOpen} {editor} />
  {/await}
{/if}

{#if setupOpen}
  {#await import("$lib/editor/SetupModal.svelte") then M}
    <M.default
      bind:open={setupOpen}
      url={shareUrl}
      width={editor.config.layout.w}
      height={editor.config.layout.h}
      lfmUser={editor.config.lfmUser}
    />
  {/await}
{/if}

<style>
  /* Reads as plain text. Each letter goes gray under the pointer and eases back
     after it leaves, so sweeping across the name leaves a short fading trail. */
  .wordmark {
    cursor: default;
  }
  .wordmark span[aria-hidden] {
    transition: color 600ms ease;
  }
  .wordmark span[aria-hidden]:hover {
    color: oklch(55.2% 0.016 285.938); /* zinc-500 */
    transition-duration: 80ms;
  }
  @media (prefers-reduced-motion: reduce) {
    .wordmark span[aria-hidden],
    .wordmark span[aria-hidden]:hover {
      transition: none;
    }
  }
</style>
