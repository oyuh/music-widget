<script lang="ts">
  interface Props {
    text?: string;
    color?: string;
    class?: string;
    /** Inline style string applied to the outer container. */
    style?: string;
    speedPxPerSec?: number;
    minWidthToScroll?: number;
    gapPx?: number;
    /**
     * Scroll direction. "auto" (default) derives left/right from the parent's
     * text-align (legacy behavior). v2 passes an explicit "left"/"right"/"bounce".
     */
    direction?: "auto" | "left" | "right" | "bounce";
    /** Element id used by the editor for hit-testing/selection. */
    dataEl?: string;
    /**
     * Force the box to stay clipped even when the text fits. Used by "escape"
     * shadow mode, where the shadow is drawn as a drop-shadow filter on the parent
     * and the text itself must stay clipped to its box.
     */
    forceClip?: boolean;
  }

  let {
    text = "",
    color,
    class: className = "",
    style = "",
    speedPxPerSec = 24,
    minWidthToScroll,
    gapPx = 32,
    direction = "auto",
    dataEl,
    forceClip = false,
  }: Props = $props();

  let outer = $state<HTMLDivElement | null>(null);
  let item = $state<HTMLSpanElement | null>(null);

  let animate = $state(false);
  let duration = $state(10);
  let scrollDistance = $state(0);
  let effectiveMode = $state<"left" | "right" | "bounce">("left");

  function measure() {
    if (!outer || !item) return;

    const parent = outer.parentElement;
    const isRightAligned = parent ? window.getComputedStyle(parent).textAlign === "right" : false;
    const mode = direction === "auto" ? (isRightAligned ? "right" : "left") : direction;

    const widthConstraint = typeof minWidthToScroll === "number" ? outer.clientWidth <= minWidthToScroll : false;
    const contentWidth = item.scrollWidth;
    const outerWidth = outer.clientWidth;
    const overflow = !!text && (widthConstraint || contentWidth > outerWidth + 2);

    if (overflow) {
      const safeSpeed = Math.max(0.1, Math.abs(speedPxPerSec || 0));
      // Bounce travels only the overflow distance (back and forth); loop modes
      // travel the full content + gap for a seamless wrap.
      const distance = mode === "bounce" ? Math.max(0, contentWidth - outerWidth) : contentWidth + gapPx;
      scrollDistance = distance;
      duration = Math.max(0.5, distance / safeSpeed);
      effectiveMode = mode;
      animate = true;
    } else {
      animate = false;
      scrollDistance = 0;
    }
  }

  $effect(() => {
    // Re-run when any measurement input changes.
    void text;
    void speedPxPerSec;
    void minWidthToScroll;
    void gapPx;
    void direction;
    if (!outer || !item) return;

    const initial = window.setTimeout(measure, 50);
    const ro = new ResizeObserver(() => window.requestAnimationFrame(measure));
    ro.observe(outer);
    ro.observe(item);
    const onResize = () => window.requestAnimationFrame(measure);
    window.addEventListener("resize", onResize);
    document.fonts?.ready.then(measure).catch(() => {});

    return () => {
      clearTimeout(initial);
      ro.disconnect();
      window.removeEventListener("resize", onResize);
    };
  });

  const animationName = $derived(
    effectiveMode === "bounce"
      ? "marquee-bounce"
      : effectiveMode === "right"
        ? "marquee-scroll-right"
        : "marquee-scroll-left",
  );
  const isBounce = $derived(animate && effectiveMode === "bounce");
  // Clip while actually scrolling, or whenever asked to (escape mode). When the
  // text fits and we're not forcing a clip, leaving it unclipped lets a normal
  // text-shadow render fully instead of being cut off at the box edge.
  const clipScroll = $derived(animate || forceClip);
  const wrapperStyle = $derived(
    [
      "display:inline-flex",
      animate && !isBounce ? `gap:${gapPx}px` : "",
      animate ? `animation:${animationName} ${duration.toFixed(2)}s linear infinite${isBounce ? " alternate" : ""}` : "",
      animate ? "will-change:transform" : "",
      `--scroll-distance:${scrollDistance}px`,
    ]
      .filter(Boolean)
      .join(";"),
  );
</script>

<div
  bind:this={outer}
  data-el={dataEl}
  class="marquee {animate ? 'marquee--animate' : ''} {className}"
  style="min-width:0;position:relative;overflow:{clipScroll ? 'hidden' : 'visible'};{style}"
>
  <div class="marquee__wrapper" style={wrapperStyle}>
    <span bind:this={item} class="marquee__item" style="color:{color};white-space:nowrap;display:inline-block">{text}</span>
    <span class="marquee__item" aria-hidden="true" style="color:{color};white-space:nowrap;display:{animate && !isBounce ? 'inline-block' : 'none'}">{text}</span>
  </div>
</div>
