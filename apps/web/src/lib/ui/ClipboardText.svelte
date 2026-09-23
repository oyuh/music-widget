<script lang="ts">
  import { ICONS } from "./icons";

  // Read-only text with a copy button, after Kumo's ClipboardText. Clicking the
  // text selects all of it (user-select: all) for copying by hand.
  interface Props {
    text: string;
    label?: string;
    oncopy?: () => void;
  }
  let { text, label = "text", oncopy }: Props = $props();

  let copied = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
      clearTimeout(timer);
      timer = setTimeout(() => (copied = false), 1500);
    } catch {
      /* ignore */
    }
    oncopy?.();
  }

  const icon =
    "absolute inset-0 grid place-items-center transition-all duration-200 motion-reduce:transition-none";
</script>

<div class="flex h-9 items-center overflow-hidden rounded-md border border-border bg-zinc-800 font-mono text-xs">
  <span class="min-w-0 grow cursor-text truncate pr-2 pl-2.5 text-muted-foreground select-all">{text}</span>
  <button
    type="button"
    onclick={copy}
    aria-label="Copy {label}"
    class="relative h-full w-9 shrink-0 overflow-hidden border-l border-border transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-inset {copied
      ? 'text-green-400'
      : 'text-muted-foreground'}"
  >
    <span class="{icon} {copied ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}">
      <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    </span>
    <span class="{icon} {copied ? '-translate-y-full opacity-0' : 'translate-y-0 opacity-100'}">
      <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <!-- eslint-disable-next-line svelte/no-at-html-tags -- static, authored markup -->
        {@html ICONS.copy}
      </svg>
    </span>
  </button>
  <span class="sr-only" aria-live="polite">{copied ? "Copied" : ""}</span>
</div>
