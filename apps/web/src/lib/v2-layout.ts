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
  V2_ELEMENT_IDS,
  type V2Edge,
  type V2Element,
  type V2ElementId,
  type V2Shadow,
  type WidgetV2,
} from "./config";
import { generateDropShadowCSS } from "./colors";

export type Box = { x: number; y: number; w: number; h: number };
export type Measured = Partial<Record<V2ElementId, { w: number; h: number }>>;

const edgeFactor = (e: V2Edge): number => (e === "start" ? 0 : e === "center" ? 0.5 : 1);

/** Effective box size: explicit w/h wins, else measured content size, else 0. */
export function effectiveSizes(
  v2: WidgetV2,
  measured: Measured,
): Record<V2ElementId, { w: number; h: number }> {
  const out = {} as Record<V2ElementId, { w: number; h: number }>;
  for (const id of V2_ELEMENT_IDS) {
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

  for (const id of V2_ELEMENT_IDS) resolve(id);
  return result;
}

/** Resolve absolute boxes for every element in a v2 layout. */
export function resolveLayout(v2: WidgetV2, measured: Measured): Record<V2ElementId, Box> {
  const size = effectiveSizes(v2, measured);
  const xs = resolveAxis("x", v2.elements, size);
  const ys = resolveAxis("y", v2.elements, size);
  const out = {} as Record<V2ElementId, Box>;
  for (const id of V2_ELEMENT_IDS) {
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

  for (const id of V2_ELEMENT_IDS) {
    if (id === "art" || id === "background") continue;
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
  for (let pass = 0; pass < V2_ELEMENT_IDS.length; pass++) {
    let changed = false;
    for (const id of V2_ELEMENT_IDS) {
      if (id === "art" || id === "background" || movedIds.has(id)) continue;
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

/** CSS box-shadow / text-shadow string for a per-element shadow (reuses colors.ts). */
export function elementShadowCSS(shadow: V2Shadow | undefined, baseColor: string): string | undefined {
  if (!shadow?.enabled) return undefined;
  return generateDropShadowCSS(shadow, baseColor) || undefined;
}
