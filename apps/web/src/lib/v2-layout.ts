// Pure layout resolver for the v2 (free-positioned) widget engine.
//
// Each element has a free (x, y) coordinate OR a per-axis snap relationship that
// anchors one of its edges to another element's edge. Because an anchor's
// resolved edge depends on the anchor's (possibly auto) size, a snapped element
// re-flows automatically when its anchor resizes , e.g. snapping the duration's
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

/** CSS box-shadow / text-shadow string for a per-element shadow (reuses colors.ts). */
export function elementShadowCSS(shadow: V2Shadow | undefined, baseColor: string): string | undefined {
  if (!shadow?.enabled) return undefined;
  return generateDropShadowCSS(shadow, baseColor) || undefined;
}
