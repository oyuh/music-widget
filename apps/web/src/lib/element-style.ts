// Pure element-styling helpers, kept out of editor.svelte.ts so they're testable
// without the Svelte compiler: none of this needs runes, it just reads and writes
// a plain config object. EditorState re-exports it all.
import {
  kindOf,
  resolveTextProps,
  V2_TEXT_IDS,
  type V2Element,
  type V2ElementId,
  type V2TextId,
  type WidgetConfig,
} from "./config";

/** True when this element renders text (checked by kind, so "title#2" counts). */
export function isTextElement(id: V2ElementId): boolean {
  return (V2_TEXT_IDS as readonly string[]).includes(kindOf(id));
}

/**
 * A view over a background's tint, which only exists once it's turned on.
 * Sliding the strength back to 0 removes it again so a design that tried the
 * tint and changed its mind encodes exactly like one that never touched it.
 */
export class TintView {
  #el: V2Element;

  constructor(el: V2Element) {
    this.#el = el;
  }

  get opacity(): number {
    return this.#el.tint?.opacity ?? 0;
  }
  set opacity(v: number) {
    if (v <= 0) delete this.#el.tint;
    else this.#el.tint = { color: this.#el.tint?.color ?? "#000000", opacity: v };
  }

  get color(): string {
    return this.#el.tint?.color ?? "#000000";
  }
  set color(v: string) {
    if (this.#el.tint) this.#el.tint.color = v;
  }
}

/**
 * A view over ONE text element's typography.
 *
 * The first instance of a kind keeps writing to theme.textSize / textStyle /
 * textTransform / textFont, so a design that never duplicates anything encodes
 * byte-for-byte what it always did (and the legacy renderer keeps working).
 * Extra instances write their own per-element override block instead. The
 * Inspector binds straight to this and never has to know which of the two it is
 * editing, so there's only one set of controls.
 */
export class TextStyleView {
  #cfg: WidgetConfig;
  #id: V2ElementId;

  constructor(cfg: WidgetConfig, id: V2ElementId) {
    this.#cfg = cfg;
    this.#id = id;
  }

  get #kind(): V2TextId {
    return kindOf(this.#id) as V2TextId;
  }

  get #isBase(): boolean {
    return !this.#id.includes("#");
  }

  // Only ever called from a setter: creating the block on read would mutate the
  // config during render.
  #setOwn(patch: Partial<NonNullable<V2Element["text"]>>) {
    const el = this.#cfg.v2!.elements[this.#id];
    el.text = { ...el.text, ...patch };
  }

  get size(): number {
    return resolveTextProps(this.#cfg, this.#id).size;
  }
  set size(v: number) {
    if (this.#isBase) this.#cfg.theme.textSize![this.#kind] = v;
    else this.#setOwn({ size: v });
  }

  get bold(): boolean {
    return resolveTextProps(this.#cfg, this.#id).bold;
  }
  set bold(v: boolean) {
    if (this.#isBase) this.#cfg.theme.textStyle![this.#kind].bold = v;
    else this.#setOwn({ bold: v });
  }

  get italic(): boolean {
    return resolveTextProps(this.#cfg, this.#id).italic;
  }
  set italic(v: boolean) {
    if (this.#isBase) this.#cfg.theme.textStyle![this.#kind].italic = v;
    else this.#setOwn({ italic: v });
  }

  get underline(): boolean {
    return resolveTextProps(this.#cfg, this.#id).underline;
  }
  set underline(v: boolean) {
    if (this.#isBase) this.#cfg.theme.textStyle![this.#kind].underline = v;
    else this.#setOwn({ underline: v });
  }

  get strike(): boolean {
    return resolveTextProps(this.#cfg, this.#id).strike;
  }
  set strike(v: boolean) {
    if (this.#isBase) this.#cfg.theme.textStyle![this.#kind].strike = v;
    else this.#setOwn({ strike: v });
  }

  get transform(): "none" | "uppercase" | "lowercase" {
    return resolveTextProps(this.#cfg, this.#id).transform;
  }
  set transform(v: "none" | "uppercase" | "lowercase") {
    if (this.#isBase) this.#cfg.theme.textTransform![this.#kind] = v;
    else this.#setOwn({ transform: v });
  }

  /** "" means the widget's global font; anything else is a Google font key. */
  get font(): string {
    const own = this.#cfg.v2!.elements[this.#id]?.text?.font;
    return own ?? this.#cfg.theme.textFont?.[this.#kind] ?? "";
  }
  set font(v: string) {
    // The theme stores "use global" as undefined; an override stores it as "",
    // which is what stops it falling back to the kind's theme font.
    if (this.#isBase) this.#cfg.theme.textFont![this.#kind] = v || undefined;
    else this.#setOwn({ font: v });
  }
}

/**
 * What "copy style" carries from one instance to another: how an element is
 * painted, not where it sits. Typography rides along separately because it can
 * live on the theme rather than on the element.
 */
const STYLE_KEYS = [
  "color",
  "fallbackColor",
  "fill",
  "fillOpacity",
  "anchor",
  "radius",
  "shadow",
  "stroke",
  "scroll",
  "tint",
] as const satisfies readonly (keyof V2Element)[];

/**
 * Take one instance's look and apply it to another of the same kind: paint and
 * typography, never placement. Position, size, layer and snaps are exactly what
 * you set two instances apart by, so copying those would just stack them.
 */
export function copyStyle(
  cfg: WidgetConfig,
  targetId: V2ElementId,
  sourceId: V2ElementId,
): boolean {
  const els = cfg.v2?.elements;
  const src = els?.[sourceId];
  const dst = els?.[targetId];
  if (!src || !dst || sourceId === targetId || kindOf(sourceId) !== kindOf(targetId)) return false;

  for (const k of STYLE_KEYS) {
    const v = src[k];
    // A missing field is meaningful (no outline, no tint), so clear rather than
    // skip, otherwise the target quietly keeps whatever it had.
    if (v === undefined) delete dst[k];
    else (dst[k] as unknown) = JSON.parse(JSON.stringify(v));
  }

  if (isTextElement(targetId)) {
    // Typography goes through the same view the Inspector writes with, so values
    // land in the theme for a base instance and in the per-element override for a
    // copy. Clearing first keeps that invariant: a base instance must not end up
    // with an override shadowing the theme its own controls edit.
    delete dst.text;
    const r = resolveTextProps(cfg, sourceId);
    const view = new TextStyleView(cfg, targetId);
    view.size = r.size;
    view.bold = r.bold;
    view.italic = r.italic;
    view.underline = r.underline;
    view.strike = r.strike;
    view.transform = r.transform;
    // Copy the font INTENT, not the resolved family: "" means "follow the
    // widget's global font", which a resolved name would silently pin.
    view.font = src.text?.font ?? cfg.theme.textFont?.[kindOf(sourceId) as V2TextId] ?? "";
  }

  return true;
}
