<script lang="ts">
  import Segmented from "$lib/ui/Segmented.svelte";
  import ClipboardText from "$lib/ui/ClipboardText.svelte";
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

  function close() {
    open = false;
  }

  function focusOnMount(node: HTMLElement) {
    node.focus();
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
        "The background is transparent, so only the widget itself draws over your scene.",
      ],
    },
  };

  const steps = $derived(
    GUIDES[platform].steps.map((s) => s.replace("{W}", String(width)).replace("{H}", String(height))),
  );
</script>

<svelte:window onkeydown={(e) => open && e.key === "Escape" && close()} />

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onclick={close} role="presentation">
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div
      class="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg border border-border bg-card p-4 text-card-foreground outline-none"
      onclick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="setup-title"
      tabindex="-1"
      use:focusOnMount
    >
      <div class="flex items-start justify-between gap-3">
        <h2 id="setup-title" class="text-base font-semibold tracking-tight">Add it to your stream</h2>
        <button
          type="button"
          onclick={close}
          aria-label="Close"
          class="-mt-1 -mr-1 grid h-11 w-11 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <path d="M18 6 6 18" /><path d="m6 6 12 12" />
          </svg>
        </button>
      </div>

      <!-- Widget URL -->
      <section class="mt-2">
        <h3 class="font-mono-ui text-xs font-medium text-muted-foreground uppercase">Your widget link</h3>
        <p class="mt-1 text-xs leading-relaxed text-muted-foreground">
          It's a browser source. Paste this into your streaming software at
          <span class="text-foreground">{width} × {height}</span> px.
        </p>
        <div class="mt-2">
          <ClipboardText text={url} label="widget link" oncopy={() => recordWidgetCopy(lfmUser)} />
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener"
          class="mt-1 inline-block rounded py-1 text-[11px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          Open it in a new tab ↗
        </a>
        <p class="mt-1 text-[11px] text-amber-500/80">
          The link holds your settings (and your API key, if you set one), so keep it private.
        </p>
      </section>

      <!-- Platform steps -->
      <section class="mt-4">
        <h3 class="font-mono-ui text-xs font-medium text-muted-foreground uppercase">Steps</h3>
        <div class="mt-2">
          <Segmented
            bind:value={platform}
            options={[
              { value: "obs", label: "OBS" },
              { value: "streamlabs", label: "Streamlabs" },
              { value: "xsplit", label: "XSplit" },
              { value: "other", label: "Other" },
            ]}
          />
        </div>
        <ol class="mt-3 list-decimal space-y-1.5 pl-4 text-xs leading-relaxed">
          {#each steps as step (step)}
            <li>{step}</li>
          {/each}
        </ol>
        <p class="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          The link changes whenever your settings do. After editing the design, copy it again and paste it into the
          same source.
        </p>
      </section>
    </div>
  </div>
{/if}
