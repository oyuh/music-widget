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
    /** Element id used by the editor for hit-testing/selection. */
    dataEl?: string;
  }

  let {
    text = "",
    color,
    class: className = "",
    style = "",
    speedPxPerSec = 24,
    minWidthToScroll,
    gapPx = 32,
    dataEl,
  }: Props = $props();

  let outer = $state<HTMLDivElement | null>(null);
  let item = $state<HTMLSpanElement | null>(null);

  let animate = $state(false);
  let duration = $state(10);
  let scrollDistance = $state(0);
  let isRightAligned = $state(false);

  function measure() {
    if (!outer || !item) return;

    const parent = outer.parentElement;
    isRightAligned = parent ? window.getComputedStyle(parent).textAlign === "right" : false;

    const widthConstraint = typeof minWidthToScroll === "number" ? outer.clientWidth <= minWidthToScroll : false;
    const contentWidth = item.scrollWidth;
    const outerWidth = outer.clientWidth;
    const overflow = !!text && (widthConstraint || contentWidth > outerWidth + 2);

    if (overflow) {
      const distance = contentWidth + gapPx;
      const safeSpeed = Math.max(0.1, Math.abs(speedPxPerSec || 0));
      scrollDistance = distance;
      duration = Math.max(0.5, distance / safeSpeed);
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

  const animationName = $derived(isRightAligned ? "marquee-scroll-right" : "marquee-scroll-left");
  const wrapperStyle = $derived(
    [
      "display:inline-flex",
      animate ? `gap:${gapPx}px` : "",
      animate ? `animation:${animationName} ${duration.toFixed(2)}s linear infinite` : "",
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
  style="min-width:0;position:relative;{style}"
>
  <div class="marquee__wrapper" style={wrapperStyle}>
    <span bind:this={item} class="marquee__item" style="color:{color};white-space:nowrap;display:inline-block">{text}</span>
    <span class="marquee__item" aria-hidden="true" style="color:{color};white-space:nowrap;display:{animate ? 'inline-block' : 'none'}">{text}</span>
  </div>
</div>
