<script lang="ts">
  import Segmented from "$lib/ui/Segmented.svelte";
  import { recordWidgetCopy } from "$lib/usage";

  interface Props {
    open: boolean;
    url: string;
    width: number;
    height: number;
    lfmUser?: string;
  }
  let { open = $bindable(), url, width, height, lfmUser = "" }: Props = $props();

  type Platform = "obs" | "streamlabs" | "xsplit" | "other";
  let platform = $state<Platform>("obs");

  let copied = $state(false);
  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(url);
      copied = true;
      setTimeout(() => (copied = false), 1500);
    } catch {
      /* ignore */
    }
    recordWidgetCopy(lfmUser);
  }

  function close() {
    open = false;
  }

  // Per-platform steps. {W}/{H} are filled with the live widget size.
  const GUIDES: Record<Platform, { label: string; steps: string[] }> = {
    obs: {
      label: "OBS Studio",
      steps: [
        "In the Sources box, click + and choose Browser.",
        'Name it (e.g. "Now Playing") and click OK.',
        "Paste your widget URL into the URL field.",
        "Set Width to {W} and Height to {H}.",
        "Click OK, then drag it where you want on your scene.",
      ],
    },
    streamlabs: {
      label: "Streamlabs",
      steps: [
        "In Sources, click + and pick Browser Source → Add Source.",
        "Paste your widget URL into the URL field.",
        "Set Width {W} and Height {H}.",
        "Click Done and position it on your scene.",
      ],
    },
    xsplit: {
      label: "XSplit",
      steps: [
        "Click Add Source → Webpage / URL (Web page source).",
        "Paste your widget URL.",
        "Resize the source to {W} × {H}.",
        "Drag it into place on your stage.",
      ],
    },
    other: {
      label: "Other",
      steps: [
        "Any app with a Browser / Web page source works (Lightstream, Twitch Studio, vMix…).",
        "Add a browser/web source and paste your widget URL.",
        "Set its size to {W} × {H}.",
        "The background is transparent, so it overlays your scene cleanly.",
      ],
    },
  };

  const steps = $derived(
    GUIDES[platform].steps.map((s) => s.replace("{W}", String(width)).replace("{H}", String(height))),
  );
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    onclick={close}
    role="presentation"
  >
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div
      class="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground"
      onclick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <div class="flex items-start justify-between gap-3 border-b border-border p-4">
        <div>
          <h2 class="text-base font-semibold tracking-tight">Add the widget to your stream</h2>
          <p class="mt-0.5 text-xs text-muted-foreground">
            It's just a browser source. Paste the URL into your streaming software and you're set.
          </p>
        </div>
        <button
          type="button"
          onclick={close}
          aria-label="Close"
          class="rounded-md px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          ✕
        </button>
      </div>

      <div class="flex min-h-0 flex-col gap-4 overflow-y-auto p-4">
        <!-- The URL + recommended size, always visible -->
        <div class="flex flex-col gap-2 rounded-md border border-border bg-zinc-900/50 p-3">
          <div class="font-pixel text-[11px] text-muted-foreground uppercase">Your widget URL</div>
          <div class="flex gap-2">
            <input
              type="text"
              readonly
              value={url}
              onclick={(e) => (e.currentTarget as HTMLInputElement).select()}
              class="min-w-0 flex-1 rounded-md border border-border bg-zinc-800 px-2 py-1.5 font-mono text-xs"
            />
            <button
              type="button"
              onclick={copyUrl}
              class="shrink-0 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
            <a
              href={url}
              target="_blank"
              rel="noopener"
              class="shrink-0 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-muted"
            >
              Open ↗
            </a>
          </div>
          <p class="text-[11px] text-muted-foreground">
            Recommended size: <span class="text-foreground">{width} × {height}</span> px. Keep this URL
            private, since it holds your settings (and your API key, if you set one).
          </p>
        </div>

        <!-- Platform picker + steps -->
        <Segmented
          bind:value={platform}
          options={[
            { value: "obs", label: "OBS" },
            { value: "streamlabs", label: "Streamlabs" },
            { value: "xsplit", label: "XSplit" },
            { value: "other", label: "Other" },
          ]}
        />

        <ol class="flex list-decimal flex-col gap-2 pl-5 text-sm">
          {#each steps as step (step)}
            <li class="leading-snug">{step}</li>
          {/each}
        </ol>

        <p class="text-[11px] text-muted-foreground">
          Edited your design? Re-copy the URL. It changes whenever your settings do, so update the source
          to see the new look.
        </p>
      </div>
    </div>
  </div>
{/if}
