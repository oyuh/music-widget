<script lang="ts">
  import { ELEMENTS, type EditorState } from "$lib/editor.svelte";
  import { PRESETS } from "$lib/presets";
  import ConfirmButton from "$lib/ui/ConfirmButton.svelte";
  import Collapsible from "$lib/ui/Collapsible.svelte";
  import SidebarFooter from "$lib/editor/SidebarFooter.svelte";
  import SetupModal from "$lib/editor/SetupModal.svelte";
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

  let copied = $state(false);
  let setupOpen = $state(false);

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
    recordWidgetCopy(editor.config.lfmUser ?? "");
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

  // ---- BYOK (bring your own Last.fm API key) ----
  let byokOpen = $state(false);
  let byokKey = $state("");
  function openByok() {
    byokKey = editor.config.apiKey ?? "";
    byokOpen = true;
  }
  function saveByok() {
    editor.config.apiKey = byokKey.trim() || null;
    editor.save();
    byokOpen = false;
  }
  function clearByok() {
    editor.config.apiKey = null;
    byokKey = "";
    editor.save();
    byokOpen = false;
  }
</script>

<div class="flex h-full flex-col gap-4 overflow-y-auto p-3 text-sm">
  <div>
    <div class="text-base font-semibold tracking-tight">fast.Jamlog.lol</div>
    <div class="text-xs text-muted-foreground">Last.fm now-playing overlay</div>
  </div>

  <!-- Last.fm account -->
  <section class="flex flex-col gap-2">
    <div class="font-pixel text-xs font-medium text-muted-foreground uppercase">Last.fm</div>
    <input
      type="text"
      placeholder="username"
      bind:value={editor.config.lfmUser}
      oninput={onUserInput}
      spellcheck="false"
      class="w-full rounded-md border border-border bg-zinc-800 px-2 py-1.5"
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
    <button
      type="button"
      onclick={openByok}
      class="text-left text-[11px] {editor.config.apiKey
        ? 'text-green-400'
        : 'text-muted-foreground'} hover:text-foreground"
    >
      {editor.config.apiKey ? "✓ Using your own API key · edit" : "Use your own API key (faster) →"}
    </button>
  </section>

  <!-- Share -->
  <section class="flex flex-col gap-2">
    <div class="font-pixel text-xs font-medium text-muted-foreground uppercase">Share</div>
    <div class="flex gap-2">
      <button
        type="button"
        onclick={copyShare}
        class="flex-1 rounded-md bg-primary px-2 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
      >
        {copied ? "Copied!" : "Copy URL"}
      </button>
      <button
        type="button"
        onclick={() => (setupOpen = true)}
        class="rounded-md border border-border px-2 py-1.5 text-xs hover:bg-muted"
      >
        Add to stream →
      </button>
    </div>
    <p class="text-[11px] leading-snug text-muted-foreground">
      Use it as a browser source in OBS, Streamlabs, XSplit and more.
    </p>
  </section>

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
  </Collapsible>

  <!-- Element list -->
  <section class="flex flex-col gap-1">
    <div class="font-pixel text-xs font-medium text-muted-foreground uppercase">Elements</div>
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

  <!-- Sidebar footer -->
  <footer class="font-pixel mt-auto border-t border-border pt-3 text-[11px] leading-relaxed text-muted-foreground">
    <SidebarFooter lfmUser={editor.config.lfmUser} />
  </footer>
</div>

{#if byokOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    onclick={() => (byokOpen = false)}
    role="presentation"
  >
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div
      class="w-full max-w-md rounded-lg border border-border bg-card p-4 text-card-foreground"
      onclick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <h2 class="text-base font-semibold tracking-tight">Use your own Last.fm API key</h2>
      <p class="mt-1 text-xs text-muted-foreground">
        Optional. Your widget makes requests with your key , faster updates, isolated from everyone else.
      </p>
      <ol class="mt-3 list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
        <li>
          Open
          <a class="text-primary underline" href="https://www.last.fm/api/account/create" target="_blank" rel="noopener noreferrer"
            >last.fm/api/account/create</a
          >
          (while logged in).
        </li>
        <li>Give it any name/description (e.g. "my widget") , no callback URL needed.</li>
        <li>Copy the <strong>API key</strong> it shows and paste it below.</li>
      </ol>
      <input
        type="text"
        bind:value={byokKey}
        placeholder="paste your API key"
        spellcheck="false"
        class="mt-3 w-full rounded-md border border-border bg-zinc-800 px-2 py-1.5 font-mono text-xs"
      />
      <p class="mt-2 text-[11px] text-amber-500/80">
        Heads up: your key is saved in the widget URL , keep that URL private.
      </p>
      <div class="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onclick={clearByok}
          class="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
        >
          Remove
        </button>
        <div class="flex gap-2">
          <button
            type="button"
            onclick={() => (byokOpen = false)}
            class="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onclick={saveByok}
            class="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<SetupModal
  bind:open={setupOpen}
  url={shareUrl}
  width={editor.config.layout.w}
  height={editor.config.layout.h}
  lfmUser={editor.config.lfmUser}
/>
