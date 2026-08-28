// Hover tooltips for plain controls (collapse arrows, zoom, status pills…), so
// they match the InfoTip card instead of the OS's grey box. Use it in place of
// a title attribute: `use:tip={"Hide sidebar"}`.
//
// InfoTip stays a separate component: it's a visible affordance with a diagram
// and credits inside it. This one is invisible until you hover the control.

const DELAY = 350;

export function tip(node: HTMLElement, text: string) {
  let label = text;
  let card: HTMLDivElement | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function place() {
    if (!card) return;
    const r = node.getBoundingClientRect();
    const c = card.getBoundingClientRect();
    // Below by default, above when the bottom of the window is in the way.
    let top = r.bottom + 8;
    if (top + c.height > window.innerHeight - 8) top = r.top - c.height - 8;
    const left = Math.max(8, Math.min(window.innerWidth - c.width - 8, r.left + r.width / 2 - c.width / 2));
    card.style.top = `${Math.max(8, top)}px`;
    card.style.left = `${left}px`;
  }

  function show() {
    if (card || !label) return;
    card = document.createElement("div");
    card.role = "tooltip";
    card.className =
      "font-mono-ui pointer-events-none fixed z-[130] max-w-[240px] rounded-md border border-border bg-card px-2 py-1.5 text-[11px] leading-snug text-muted-foreground shadow-xl";
    card.textContent = label;
    // Placed off-screen for one frame so it can be measured before it's seen.
    card.style.cssText += ";top:-9999px;left:-9999px";
    document.body.appendChild(card);
    place();
  }

  function hide() {
    clearTimeout(timer);
    card?.remove();
    card = null;
  }

  const onEnter = () => {
    clearTimeout(timer);
    timer = setTimeout(show, DELAY);
  };

  node.addEventListener("mouseenter", onEnter);
  node.addEventListener("mouseleave", hide);
  node.addEventListener("pointerdown", hide);
  node.addEventListener("focus", show);
  node.addEventListener("blur", hide);
  window.addEventListener("scroll", hide, true);

  return {
    update(next: string) {
      label = next;
      if (card) card.textContent = next;
    },
    destroy() {
      hide();
      node.removeEventListener("mouseenter", onEnter);
      node.removeEventListener("mouseleave", hide);
      node.removeEventListener("pointerdown", hide);
      node.removeEventListener("focus", show);
      node.removeEventListener("blur", hide);
      window.removeEventListener("scroll", hide, true);
    },
  };
}
