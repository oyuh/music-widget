// Pure layout resolver for the v2 (free-positioned) widget engine.
//
// Each element has a free (x, y) coordinate OR a per-axis snap relationship that
// anchors one of its edges to another element's edge. Because an anchor's
// resolved edge depends on the anchor's (possibly auto) size, a snapped element
// re-flows automatically when its anchor resizes, e.g. snapping the duration's
// left edge to the artist's right edge makes the duration track the artist width.
//
// Sizes are position-independent, so there is no feedback loop between sizes and
// positions: measure once, then resolve positions.
import {
  kindOf,
  type V2Edge,
  type V2Element,
  type V2ElementId,
  type V2Shadow,
  type V2Stroke,
  type WidgetV2,
} from "./config";
import { generateDropShadowCSS, hexToRgb } from "./colors";

export type Box = { x: number; y: number; w: number; h: number };
export type Measured = Partial<Record<V2ElementId, { w: number; h: number }>>;

const edgeFactor = (e: V2Edge): number => (e === "start" ? 0 : e === "center" ? 0.5 : 1);

/** Effective box size: explicit w/h wins, else measured content size, else 0. */
export function effectiveSizes(
  v2: WidgetV2,
  measured: Measured,
): Record<V2ElementId, { w: number; h: number }> {
  const out = {} as Record<V2ElementId, { w: number; h: number }>;
  for (const id of Object.keys(v2.elements)) {
    const el = v2.elements[id];
    out[id] = {
      w: el?.w ?? measured[id]?.w ?? 0,
      h: el?.h ?? measured[id]?.h ?? 0,
    };
  }
  return out;
}

/**
 * Resolve one axis (x|y) for every element. Snapped elements are resolved via
 * memoized recursion over their anchor dependency; cycles and missing/hidden
 * anchors fall back to the element's free coordinate.
 */
function resolveAxis(
  axis: "x" | "y",
  els: Record<V2ElementId, V2Element>,
  size: Record<V2ElementId, { w: number; h: number }>,
): Record<V2ElementId, number> {
  const dim = axis === "x" ? "w" : "h";
  const snapKey = axis === "x" ? "snapX" : "snapY";
  const result = {} as Record<V2ElementId, number>;
  const done = new Set<V2ElementId>();
  const inStack = new Set<V2ElementId>();

  const resolve = (id: V2ElementId): number => {
    if (done.has(id)) return result[id];
    const el = els[id];
    const free = (el?.[axis] as number) ?? 0;

    // Re-entry while resolving => cycle: break it with the free coordinate.
    if (inStack.has(id)) {
      result[id] = free;
      done.add(id);
      return free;
    }

    const snap = el?.[snapKey];
    const anchor = snap ? els[snap.to] : undefined;
    if (!snap || !anchor || snap.to === id || !anchor.visible) {
      result[id] = free;
      done.add(id);
      return free;
    }

    inStack.add(id);
    const anchorPos = resolve(snap.to);
    inStack.delete(id);

    const anchorEdge = anchorPos + edgeFactor(snap.toEdge) * size[snap.to][dim];
    const myEdgePos = anchorEdge + snap.offset;
    const coord = myEdgePos - edgeFactor(snap.myEdge) * size[id][dim];
    result[id] = Math.round(coord);
    done.add(id);
    return result[id];
  };

  for (const id of Object.keys(els)) resolve(id);
  return result;
}

/** Resolve absolute boxes for every element in a v2 layout. */
export function resolveLayout(v2: WidgetV2, measured: Measured): Record<V2ElementId, Box> {
  const size = effectiveSizes(v2, measured);
  const xs = resolveAxis("x", v2.elements, size);
  const ys = resolveAxis("y", v2.elements, size);
  const out = {} as Record<V2ElementId, Box>;
  for (const id of Object.keys(v2.elements)) {
    out[id] = { x: xs[id], y: ys[id], w: size[id].w, h: size[id].h };
  }
  return out;
}

// Which widget side an element flushes to when the art is gone. Uses the cues the
// design carries: the SCROLL direction (left/right), else WHICH art edge it snapped to
// (sat to the art's right => flush left), else the side the art was hugging.
function goneSide(el: V2Element, artNearLeft: boolean): "left" | "right" {
  const dir = el.scroll?.enabled ? el.scroll.direction : undefined;
  if (dir === "left") return "left";
  if (dir === "right") return "right";
  if (el.snapX?.to === "art") return el.snapX.toEdge === "start" ? "right" : "left";
  return artNearLeft ? "left" : "right";
}

/**
 * Re-anchor elements when the album art is gone (failed to load), so text flushes
 * to the matching WIDGET edge (plus its own snap offset) instead of floating in the
 * gap the art left behind. Pure: returns adjusted boxes, never touches the config,
 * so the layout reverts on its own when the art comes back.
 *
 * A FIXED-width element doesn't just translate: its near edge flushes into the gap
 * while its far edge stays put, so the box stretches to absorb the freed space.
 * Auto-width elements move as-is. Elements snapped to a re-anchored element ride
 * along by the movement of the specific anchor edge they snap to; a stretched
 * anchor's far edge hasn't moved, so an end-snapped follower stays where it is.
 *
 * Only the PRIMARY art drives this. Extra art instances are decoration: they
 * disappear on failure like any other image and nothing re-anchors to them.
 */
export function reflowArtGone(
  v2: WidgetV2,
  raw: Record<V2ElementId, Box>,
): Record<V2ElementId, Box> {
  const art = raw.art;
  const widgetW = raw.background.w || 0;
  const artCenter = art.x + art.w / 2;
  const artNearLeft = art.x <= widgetW - (art.x + art.w);
  const out = { ...raw } as Record<V2ElementId, Box>;
  const movedIds = new Set<V2ElementId>();

  // Move a box toward the gap: fixed-width boxes keep their far edge and stretch
  // over the freed space; auto-width boxes translate.
  const moveBox = (b: Box, shift: number, fixedW: boolean): Box => {
    shift = Math.round(shift);
    if (!shift || !fixedW) return { ...b, x: b.x + shift };
    return shift < 0 ? { ...b, x: b.x + shift, w: b.w - shift } : { ...b, w: b.w + shift };
  };

  const ids = Object.keys(v2.elements);
  const skip = (id: V2ElementId) => kindOf(id) === "art" || kindOf(id) === "background";

  for (const id of ids) {
    if (skip(id)) continue;
    const el = v2.elements[id];
    if (!el.visible || el.snapX?.to !== "art") continue;
    const b = raw[id];
    const onFarSide = artNearLeft ? b.x + b.w / 2 >= artCenter : b.x + b.w / 2 <= artCenter;
    if (!onFarSide) continue;
    const off = Math.abs(el.snapX.offset ?? 0);
    const x = goneSide(el, artNearLeft) === "right" ? Math.max(0, widgetW - b.w - off) : off;
    out[id] = moveBox(b, x - b.x, el.w != null);
    movedIds.add(id);
  }

  // Ripple down snapX chains: a follower moves by however far the anchor edge it
  // snaps to moved (zero for a stretched anchor's far edge).
  const edgeX = (b: Box, e: V2Edge) => b.x + edgeFactor(e) * b.w;
  for (let pass = 0; pass < ids.length; pass++) {
    let changed = false;
    for (const id of ids) {
      if (skip(id) || movedIds.has(id)) continue;
      const el = v2.elements[id];
      const snap = el.snapX;
      if (!el.visible || !snap || !movedIds.has(snap.to)) continue;
      const shift = edgeX(out[snap.to], snap.toEdge) - edgeX(raw[snap.to], snap.toEdge);
      out[id] = moveBox(raw[id], shift, el.w != null);
      movedIds.add(id);
      changed = true;
    }
    if (!changed) break;
  }
  return out;
}

/**
 * CSS box-shadow / text-shadow string for a per-element shadow (reuses colors.ts).
 * `spread` (box-shadow only) lets an outlined element's shadow hug the outline.
 */
export function elementShadowCSS(
  shadow: V2Shadow | undefined,
  baseColor: string,
  spread = 0,
): string | undefined {
  if (!shadow?.enabled) return undefined;
  return generateDropShadowCSS(shadow, baseColor, spread) || undefined;
}

export type StrokeCSS = {
  text: string; // glyph outline (text elements)
  box: string; // box-edge outline (everything else)
  outward: number; // px the BOX outline pushes the silhouette outward
  textOutward: number; // px the GLYPH outline reaches past the letters
};

/**
 * A smooth outline around the letters: copies of the text placed around a circle of
 * radius `r`, whose union is exactly the glyphs grown by `r`.
 *
 * -webkit-text-stroke would be a single property, but Chromium strokes the glyph
 * PATH with miter joins, so every sharp corner (an M's apex, an e's terminal) shoots
 * out a spike. Copies have no joins to miter, so this follows the font exactly at
 * any thickness, and it always sits behind the letters, so it can never eat them.
 */
function glyphRing(r: number, color: string): string {
  // Enough copies that neighbours overlap: the widest gap left between two of them
  // is r * (1 - cos(pi / steps)), well under a tenth of a pixel at this rate.
  const steps = Math.max(8, Math.ceil(r * 4));
  const parts: string[] = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    parts.push(`${(Math.cos(a) * r).toFixed(2)}px ${(Math.sin(a) * r).toFixed(2)}px 0 ${color}`);
  }
  return parts.join(",");
}

/**
 * CSS for an element outline. `color` must already be resolved (accent handled by
 * the caller), because this only turns it into rgba with the stroke's opacity.
 *
 * Text gets a ring of text-shadow copies (see glyphRing) and ignores `align`: the
 * ring is always drawn behind the letters, which is the only arrangement that keeps
 * them readable, and it is what an outline is for here. The inside/center variants
 * this used to have needed -webkit-text-stroke (spiky) or -webkit-mask-clip (which
 * blanks scrolling text entirely, since the text lives in child elements).
 *
 * Boxes use `outline` + `outline-offset`, where all three alignments are exact: it
 * follows border-radius, costs no layout (so nothing here can move an element), and
 * paints ABOVE content, which an inset box-shadow does not, so an inside outline
 * shows up on the album art.
 */
export function elementStrokeCSS(stroke: V2Stroke | undefined, color: string): StrokeCSS | null {
  if (!stroke?.enabled || !(stroke.width > 0)) return null;
  const rgb = hexToRgb(color);
  const alpha = Math.max(0, Math.min(100, stroke.opacity)) / 100;
  const c = rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})` : color;
  const w = stroke.width;

  const text = `text-shadow:${glyphRing(w, c)}`;

  const offset = stroke.align === "outside" ? 0 : stroke.align === "center" ? -w / 2 : -w;
  const box = `outline:${w}px solid ${c};outline-offset:${offset}px`;

  const outward = stroke.align === "outside" ? w : stroke.align === "center" ? w / 2 : 0;
  return { text, box, outward, textOutward: w };
}
