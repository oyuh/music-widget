<script lang="ts">
  import { ELEMENTS, type EditorState } from "$lib/editor.svelte";
  import { PRESETS } from "$lib/presets";
  import ConfirmButton from "$lib/ui/ConfirmButton.svelte";

  interface Props {
    editor: EditorState;
  }
  let { editor }: Props = $props();

  let copied = $state(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  // Recomputes whenever the config changes (exportHash reads it).
  const shareUrl = $derived(`${origin}/w#${editor.exportHash()}`);

  async function copyShare() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      copied = true;
      setTimeout(() => (copied = false), 1500);
    } catch {
      /* ignore */
    }
  }

  function connect() {
    const key = import.meta.env.VITE_LFM_KEY;
    const cb = import.meta.env.VITE_LFM_CALLBACK || `${origin}/callback`;
    if (!key) return;
    editor.save();
    window.location.href = `https://www.last.fm/api/auth/?api_key=${key}&cb=${encodeURIComponent(cb)}`;
  }

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
</script>

<div class="flex h-full flex-col gap-4 overflow-y-auto p-3 text-sm">
  <div>
    <div class="text-base font-semibold tracking-tight">Music Widget</div>
    <div class="text-xs text-muted-foreground">Last.fm now-playing overlay</div>
  </div>

  <!-- Last.fm account -->
  <section class="flex flex-col gap-2">
    <div class="text-xs font-medium text-muted-foreground uppercase">Last.fm</div>
    <input
      type="text"
      placeholder="username"
      bind:value={editor.config.lfmUser}
      oninput={onUserInput}
      spellcheck="false"
      class="w-full rounded-md border border-border bg-background px-2 py-1.5"
    />
    {#if editor.sessionName}
      <div class="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5 text-xs">
        <span class="truncate text-green-400">✓ {editor.sessionName}</span>
        <button type="button" onclick={() => editor.disconnect()} class="text-muted-foreground hover:text-foreground">
          Disconnect
        </button>
      </div>
    {:else}
      <button
        type="button"
        onclick={connect}
        class="rounded-md border border-border px-2 py-1.5 text-xs hover:bg-muted"
      >
        Connect for private profile
      </button>
    {/if}
  </section>

  <!-- Share -->
  <section class="flex flex-col gap-2">
    <div class="text-xs font-medium text-muted-foreground uppercase">Share</div>
    <div class="flex gap-2">
      <button
        type="button"
        onclick={copyShare}
        class="flex-1 rounded-md bg-primary px-2 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
      >
        {copied ? "Copied!" : "Copy widget URL"}
      </button>
      <a
        href={shareUrl}
        target="_blank"
        rel="noopener"
        class="rounded-md border border-border px-2 py-1.5 text-xs hover:bg-muted"
      >
        Open ↗
      </a>
    </div>
    <p class="text-[11px] leading-snug text-muted-foreground">
      Add this URL as an OBS Browser Source.
    </p>
  </section>

  <!-- Import -->
  <section class="flex flex-col gap-2">
    <div class="text-xs font-medium text-muted-foreground uppercase">Import</div>
    <input
      type="text"
      bind:value={importText}
      placeholder="paste a /w link or base64"
      spellcheck="false"
      onkeydown={(e) => e.key === "Enter" && doImport()}
      class="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
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
  </section>

  <!-- Presets -->
  <section class="flex flex-col gap-2">
    <div class="text-xs font-medium text-muted-foreground uppercase">Presets</div>
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
  </section>

  <!-- Saved presets -->
  <section class="flex flex-col gap-2">
    <div class="flex items-center justify-between">
      <div class="text-xs font-medium text-muted-foreground uppercase">My Presets</div>
      <div class="text-[11px] text-muted-foreground">{editor.customPresets.length}/10</div>
    </div>
    <div class="flex gap-2">
      <input
        type="text"
        bind:value={newPresetName}
        placeholder="preset name"
        maxlength="24"
        spellcheck="false"
        class="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs"
      />
      <button
        type="button"
        onclick={savePreset}
        disabled={!editor.canSavePreset}
        title={editor.canSavePreset ? "Save current look" : "Limit of 10 reached"}
        class="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-40"
      >
        Save
      </button>
    </div>

    {#each editor.customPresets as p (p.id)}
      <div class="rounded-md border border-border p-2">
        <div class="mb-1.5 truncate text-xs font-medium" title={p.name}>{p.name}</div>
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
  </section>

  <!-- Element list -->
  <section class="flex flex-col gap-1">
    <div class="text-xs font-medium text-muted-foreground uppercase">Elements</div>
    {#each ELEMENTS as el (el.id)}
      <button
        type="button"
        onclick={() => editor.select(el.id)}
        class="flex items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors {editor.selected ===
        el.id
          ? 'bg-primary text-primary-foreground'
          : 'hover:bg-muted'}"
      >
        <span class="w-4 text-center opacity-70">{el.icon}</span>
        <span>{el.label}</span>
      </button>
    {/each}
  </section>
</div>
