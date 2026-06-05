<script lang="ts">
  import InfoTip from "./InfoTip.svelte";
  interface Props {
    value?: string;
    label?: string;
    /** Allow the special "accent" value (uses album-art / accent color). */
    allowAccent?: boolean;
    /** Show an opacity slider (writes #rrggbbaa). */
    allowAlpha?: boolean;
    /** Swatch-only: hide the hex field + accent button (e.g. a toolbar swatch). */
    compact?: boolean;
    hint?: string;
    diagram?: string;
  }
  let {
    value = $bindable("#ffffff"),
    label = "",
    allowAccent = false,
    allowAlpha = false,
    compact = false,
    hint = "",
    diagram = "",
  }: Props = $props();

  const ACCENT_SWATCH = "linear-gradient(135deg,#ff4d4d,#ffd24d,#4dff77,#4dd2ff,#4d7bff,#d24dff)";

  let open = $state(false);
  let root = $state<HTMLDivElement | null>(null);
  let btn = $state<HTMLButtonElement | null>(null);
  let popEl = $state<HTMLElement | null>(null);
  let popX = $state(0);
  let popY = $state(0);

  const isAccent = $derived(value === "accent");
  // Safe CSS for the swatch , falls back to the rainbow for non-color values
  // (e.g. the editor backdrop's "checker").
  const swatchBg = $derived(isAccent || !/^(#|rgb|hsl)/.test(value || "") ? ACCENT_SWATCH : value);

  // HSV is the working source of truth while interacting (keeps hue stable in
  // grayscale). a = 0..255 alpha.
  let h = $state(0);
  let s = $state(0);
  let v = $state(1);
  let a = $state(255);

  // --- color math ---
  function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})/i.exec(hex.trim());
    if (!m) return null;
    const full = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
    const n = parseInt(full, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  const toHex2 = (x: number) => Math.round(Math.min(255, Math.max(0, x))).toString(16).padStart(2, "0");
  const rgbToHex = (r: number, g: number, b: number) => `#${toHex2(r)}${toHex2(g)}${toHex2(b)}`;
  function rgbToHsv(r: number, g: number, b: number) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let hh = 0;
    if (d) {
      if (max === r) hh = ((g - b) / d) % 6;
      else if (max === g) hh = (b - r) / d + 2;
      else hh = (r - g) / d + 4;
      hh *= 60;
      if (hh < 0) hh += 360;
    }
    return { h: hh, s: max === 0 ? 0 : d / max, v: max };
  }
  function hsvToRgb(h: number, s: number, v: number) {
    const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
    let r = 0, g = 0, b = 0;
    if (h < 60) (r = c), (g = x);
    else if (h < 120) (r = x), (g = c);
    else if (h < 180) (g = c), (b = x);
    else if (h < 240) (g = x), (b = c);
    else if (h < 300) (r = x), (b = c);
    else (r = c), (b = x);
    return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
  }
  function parseAlpha(val: string): number {
    if (val?.startsWith("#") && val.length === 9) {
      const aa = parseInt(val.slice(7, 9), 16);
      return Number.isFinite(aa) ? aa : 255;
    }
    return 255;
  }
  const compose = (hex6: string, aa: number) => (aa >= 255 ? hex6 : hex6 + toHex2(aa));

  // Keep the working HSV in sync with externally-set values (typing, presets,
  // accent toggle) without clobbering it during a drag.
  $effect(() => {
    const val = value;
    if (val === "accent") return;
    const rgb = hexToRgb(val);
    if (!rgb) return;
    const cur = hsvToRgb(h, s, v);
    if (Math.round(cur.r) !== rgb.r || Math.round(cur.g) !== rgb.g || Math.round(cur.b) !== rgb.b) {
      const got = rgbToHsv(rgb.r, rgb.g, rgb.b);
      h = got.h;
      s = got.s;
      v = got.v;
    }
    a = parseAlpha(val);
  });

  const rgb = $derived(hsvToRgb(h, s, v));
  const hex6 = $derived(rgbToHex(rgb.r, rgb.g, rgb.b));
  const alphaPct = $derived(Math.round((a / 255) * 100));

  function emit() {
    value = compose(hex6, allowAlpha ? a : 255);
  }

  // --- popover placement (fixed, so it escapes the inspector's overflow) ---
  function place() {
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const pw = 232;
    const ph = allowAlpha ? 300 : 270;
    const up = r.bottom + ph > window.innerHeight && r.top > ph;
    // Right-align the panel to the swatch when it sits in the right part of the
    // screen, so a top-right toolbar swatch opens as a tidy dropdown.
    const x = r.left + pw > window.innerWidth - 8 ? r.right - pw : r.left;
    popX = Math.max(8, Math.min(x, window.innerWidth - pw - 8));
    popY = up ? r.top - ph - 6 : r.bottom + 6;
  }
  function toggle() {
    open = !open;
    if (open) place();
  }
  // Move the popover to <body> so it floats above every stacking context
  // (toolbars, zoom bar, transformed canvas) instead of being trapped in one.
  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return { destroy: () => node.remove() };
  }
  $effect(() => {
    if (!open) return;
    const onScroll = () => place();
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (root && !root.contains(t) && popEl && !popEl.contains(t)) open = false;
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    window.addEventListener("pointerdown", onDown, true);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("pointerdown", onDown, true);
    };
  });

  // --- drag handlers ---
  let svEl = $state<HTMLDivElement | null>(null);
  let hueEl = $state<HTMLDivElement | null>(null);
  function drag(el: HTMLElement | null, onMove: (e: PointerEvent) => void, e: PointerEvent) {
    if (!el) return;
    e.preventDefault();
    onMove(e);
    const mv = (ev: PointerEvent) => onMove(ev);
    const up = () => {
      window.removeEventListener("pointermove", mv);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", mv);
    window.addEventListener("pointerup", up);
  }
  function svMove(e: PointerEvent) {
    if (!svEl) return;
    const r = svEl.getBoundingClientRect();
    s = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    v = Math.min(1, Math.max(0, 1 - (e.clientY - r.top) / r.height));
    emit();
  }
  function hueMove(e: PointerEvent) {
    if (!hueEl) return;
    const r = hueEl.getBoundingClientRect();
    h = Math.min(360, Math.max(0, ((e.clientX - r.left) / r.width) * 360));
    emit();
  }
  function onAlpha(e: Event) {
    a = Math.round((Math.min(100, Math.max(0, Number((e.currentTarget as HTMLInputElement).value))) * 255) / 100);
    emit();
  }
  function setHex(e: Event) {
    const rg = hexToRgb((e.currentTarget as HTMLInputElement).value);
    if (rg) value = compose(rgbToHex(rg.r, rg.g, rg.b), allowAlpha ? a : 255);
  }
  function setChannel(ch: "r" | "g" | "b", e: Event) {
    const n = Math.min(255, Math.max(0, Number((e.currentTarget as HTMLInputElement).value) || 0));
    const c = { r: Math.round(rgb.r), g: Math.round(rgb.g), b: Math.round(rgb.b) };
    c[ch] = n;
    value = compose(rgbToHex(c.r, c.g, c.b), allowAlpha ? a : 255);
  }
  const stopKeys = (e: KeyboardEvent) => e.stopPropagation();
  const numCls =
    "mw-num w-full rounded border border-border bg-zinc-800 px-1 py-1 text-center font-mono text-[11px] text-foreground outline-none focus:border-primary";
</script>

<div class={compact ? "inline-flex items-center" : "block"} bind:this={root}>
  {#if label && !compact}
    <div class="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
      {label}
      {#if hint}<InfoTip text={hint} diagram={diagram || undefined} {label} />{/if}
    </div>
  {/if}
  <div class="flex items-center gap-2">
    <button
      type="button"
      bind:this={btn}
      onclick={toggle}
      title={compact ? label || "Custom color" : undefined}
      aria-label="{label || 'color'} picker"
      class="relative shrink-0 overflow-hidden rounded-md border border-border {compact ? 'h-7 w-7' : 'h-8 w-8'} {isAccent
        ? ''
        : 'cc-checker'} {open ? 'ring-2 ring-primary' : ''}"
    >
      <span class="absolute inset-0" style="background:{swatchBg}"></span>
    </button>
    {#if !compact}
      <input
        type="text"
        bind:value
        spellcheck="false"
        onkeydown={stopKeys}
        class="min-w-0 flex-1 rounded-md border border-border bg-zinc-800 px-2 py-1.5 font-mono text-xs outline-none focus:border-primary"
      />
      {#if allowAccent}
        <button
          type="button"
          onclick={() => (value = isAccent ? hex6 : "accent")}
          title="Use accent / album-art color"
          class="shrink-0 rounded-md border px-2 py-1.5 text-xs {isAccent
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-border hover:bg-muted'}"
        >
          auto
        </button>
      {/if}
    {/if}
  </div>

  {#if open}
    <div
      bind:this={popEl}
      use:portal
      class="fixed z-[100] w-[232px] rounded-lg border border-border bg-card p-3 shadow-xl"
      style="left:{popX}px;top:{popY}px"
    >
      {#if isAccent}
        <p class="text-xs text-muted-foreground">
          Using the accent / album-art color. Turn off <b>auto</b> to pick a custom color.
        </p>
      {:else}
        <!-- saturation / value -->
        <div
          bind:this={svEl}
          onpointerdown={(e) => drag(svEl, svMove, e)}
          role="slider"
          aria-label="saturation and brightness"
          aria-valuenow={Math.round(v * 100)}
          tabindex="0"
          class="relative h-32 w-full cursor-crosshair touch-none overflow-hidden rounded-md border border-border"
          style="background:linear-gradient(to top,#000,transparent),linear-gradient(to right,#fff,hsl({h} 100% 50%))"
        >
          <span
            class="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
            style="left:{s * 100}%;top:{(1 - v) * 100}%;background:{hex6}"
          ></span>
        </div>

        <!-- hue -->
        <div
          bind:this={hueEl}
          onpointerdown={(e) => drag(hueEl, hueMove, e)}
          role="slider"
          aria-label="hue"
          aria-valuenow={Math.round(h)}
          tabindex="0"
          class="relative mt-3 h-3 w-full cursor-pointer touch-none rounded-full"
          style="background:linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)"
        >
          <span
            class="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
            style="left:{(h / 360) * 100}%;background:hsl({h} 100% 50%)"
          ></span>
        </div>

        {#if allowAlpha}
          <div class="relative mt-3 h-3 w-full overflow-hidden rounded-full cc-checker">
            <div class="absolute inset-0 rounded-full" style="background:linear-gradient(to right,transparent,{hex6})"></div>
            <input
              type="range"
              min="0"
              max="100"
              value={alphaPct}
              oninput={onAlpha}
              onkeydown={stopKeys}
              aria-label="opacity"
              class="absolute inset-0 m-0 h-full w-full cursor-pointer opacity-0"
            />
            <span
              class="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
              style="left:{alphaPct}%;background:{hex6}"
            ></span>
          </div>
        {/if}

        <!-- hex + rgb (+ opacity readout) -->
        <div class="mt-3 flex items-end gap-1.5">
          <label class="flex-1 text-center text-[10px] text-muted-foreground">
            HEX
            <input value={value} onchange={setHex} onkeydown={stopKeys} spellcheck="false" class="{numCls} text-left" />
          </label>
          <label class="w-9 text-center text-[10px] text-muted-foreground">
            R<input type="number" min="0" max="255" value={Math.round(rgb.r)} onchange={(e) => setChannel("r", e)} onkeydown={stopKeys} class={numCls} />
          </label>
          <label class="w-9 text-center text-[10px] text-muted-foreground">
            G<input type="number" min="0" max="255" value={Math.round(rgb.g)} onchange={(e) => setChannel("g", e)} onkeydown={stopKeys} class={numCls} />
          </label>
          <label class="w-9 text-center text-[10px] text-muted-foreground">
            B<input type="number" min="0" max="255" value={Math.round(rgb.b)} onchange={(e) => setChannel("b", e)} onkeydown={stopKeys} class={numCls} />
          </label>
          {#if allowAlpha}
            <label class="w-9 text-center text-[10px] text-muted-foreground">
              A<input type="number" min="0" max="100" value={alphaPct} onchange={onAlpha} onkeydown={stopKeys} class={numCls} />
            </label>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .mw-num::-webkit-outer-spin-button,
  .mw-num::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  .mw-num {
    -moz-appearance: textfield;
    appearance: textfield;
  }
</style>
