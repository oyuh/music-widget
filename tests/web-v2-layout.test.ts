import { test, expect, describe } from "bun:test";
import { reflowArtGone, resolveLayout, type Measured } from "../apps/web/src/lib/v2-layout";
import {
  V2_ELEMENT_IDS,
  migrateToV2,
  defaultConfig,
  type V2Element,
  type V2ElementId,
  type V2Snap,
  type WidgetV2,
} from "../apps/web/src/lib/config";

function el(over: Partial<V2Element> = {}): V2Element {
  return {
    visible: true,
    x: 0,
    y: 0,
    w: null,
    h: null,
    z: 0,
    color: "#ffffff",
    fill: "color",
    fillOpacity: 100,
    anchor: "left",
    shadow: { enabled: false, blur: 4, intensity: 50, offsetX: 2, offsetY: 2, useOppositeColor: true },
    scroll: { enabled: false, direction: "left", speedPxPerSec: 24, gapPx: 32 },
    radius: 0,
    snapX: null,
    snapY: null,
    ...over,
  };
}

/** Build a full v2 layout from a few element overrides. */
function v2(overrides: Partial<Record<V2ElementId, Partial<V2Element>>> = {}): WidgetV2 {
  const elements = {} as Record<V2ElementId, V2Element>;
  for (const id of V2_ELEMENT_IDS) elements[id] = el(overrides[id]);
  return { elements, switchAnim: { type: "fade", direction: "up", durationMs: 350, easing: "cubicOut" } };
}

describe("resolveLayout", () => {
  test("free positions resolve to their x/y and explicit/measured sizes", () => {
    const layout = v2({
      title: { x: 10, y: 20, w: 100, h: 16 },
      artist: { x: 30, y: 40 }, // auto size -> measured
    });
    const measured: Measured = { artist: { w: 55, h: 14 } };
    const boxes = resolveLayout(layout, measured);
    expect(boxes.title).toEqual({ x: 10, y: 20, w: 100, h: 16 });
    expect(boxes.artist).toEqual({ x: 30, y: 40, w: 55, h: 14 });
  });

  test("snap start->end positions the element after the anchor (+offset)", () => {
    const snap: V2Snap = { to: "artist", myEdge: "start", toEdge: "end", offset: 8 };
    const layout = v2({
      artist: { x: 100, w: 50, h: 14 },
      duration: { x: 0, w: 40, h: 11, snapX: snap },
    });
    const boxes = resolveLayout(layout, {});
    // artist end = 100 + 50 = 150; duration start = 150 + 8 = 158
    expect(boxes.duration.x).toBe(158);
  });

  test("snapped element tracks the anchor's width changes", () => {
    const snap: V2Snap = { to: "artist", myEdge: "start", toEdge: "end", offset: 8 };
    const base = (artistW: number) =>
      resolveLayout(
        v2({ artist: { x: 100, w: artistW, h: 14 }, duration: { w: 40, h: 11, snapX: snap } }),
        {},
      ).duration.x;
    expect(base(50)).toBe(158);
    expect(base(90)).toBe(198); // wider artist pushes the duration right
  });

  test("auto-width anchor tracks measured width too", () => {
    const snap: V2Snap = { to: "artist", myEdge: "start", toEdge: "end", offset: 0 };
    const layout = v2({ artist: { x: 100 }, duration: { w: 40, snapX: snap } });
    expect(resolveLayout(layout, { artist: { w: 30, h: 14 } }).duration.x).toBe(130);
    expect(resolveLayout(layout, { artist: { w: 70, h: 14 } }).duration.x).toBe(170);
  });

  test("center->center aligns midpoints", () => {
    const snap: V2Snap = { to: "background", myEdge: "center", toEdge: "center", offset: 0 };
    const layout = v2({
      background: { x: 0, w: 400, h: 100 },
      title: { w: 80, h: 16, snapX: snap },
    });
    // background center = 200; title center should sit at 200 => x = 200 - 40 = 160
    expect(resolveLayout(layout, {}).title.x).toBe(160);
  });

  test("end->end with offset right-aligns within a gap", () => {
    const snap: V2Snap = { to: "background", myEdge: "end", toEdge: "end", offset: -10 };
    const layout = v2({ background: { x: 0, w: 400 }, title: { w: 80, snapX: snap } });
    // bg end = 400; my end = 390; x = 390 - 80 = 310
    expect(resolveLayout(layout, {}).title.x).toBe(310);
  });

  test("missing/hidden anchor falls back to free coordinate", () => {
    const snap: V2Snap = { to: "art", myEdge: "start", toEdge: "end", offset: 5 };
    const layout = v2({ art: { visible: false, x: 0, w: 88 }, title: { x: 42, snapX: snap } });
    expect(resolveLayout(layout, {}).title.x).toBe(42);
  });

  test("cycles resolve without hanging (fall back to free)", () => {
    const layout = v2({
      title: { x: 10, w: 50, snapX: { to: "artist", myEdge: "start", toEdge: "end", offset: 0 } },
      artist: { x: 20, w: 50, snapX: { to: "title", myEdge: "start", toEdge: "end", offset: 0 } },
    });
    const boxes = resolveLayout(layout, {});
    // Must terminate and produce finite numbers.
    expect(Number.isFinite(boxes.title.x)).toBe(true);
    expect(Number.isFinite(boxes.artist.x)).toBe(true);
  });

  test("X and Y snaps are independent", () => {
    const layout = v2({
      art: { x: 0, y: 0, w: 88, h: 88 },
      title: {
        w: 60,
        h: 16,
        snapX: { to: "art", myEdge: "start", toEdge: "end", offset: 12 },
        snapY: { to: "art", myEdge: "start", toEdge: "start", offset: 4 },
      },
    });
    const boxes = resolveLayout(layout, {});
    expect(boxes.title.x).toBe(100); // 88 + 12
    expect(boxes.title.y).toBe(4); // art top + 4
  });
});

describe("reflowArtGone", () => {
  // Art on the left (88px) with a fixed-width title snapped to its right edge —
  // the Modern Card shape.
  const cardLayout = (over: Partial<Record<V2ElementId, Partial<V2Element>>> = {}) =>
    v2({
      background: { x: 0, y: 0, w: 400, h: 100 },
      art: { x: 0, y: 0, w: 88, h: 88 },
      title: {
        w: 50,
        h: 16,
        x: 12,
        snapX: { to: "art", myEdge: "start", toEdge: "end", offset: 10 },
      },
      ...over,
    });

  test("fixed-width element flushes its start edge but keeps its far edge (stretches)", () => {
    const layout = cardLayout();
    const raw = resolveLayout(layout, {});
    expect(raw.title.x).toBe(98); // 88 + 10
    const out = reflowArtGone(layout, raw);
    expect(out.title.x).toBe(10); // flush left at |offset|
    expect(out.title.x + out.title.w).toBe(raw.title.x + raw.title.w); // far edge unchanged
    expect(out.title.w).toBe(138); // 50 + the 88px the art freed up
  });

  test("pure: raw boxes are untouched, so the layout reverts when art is back", () => {
    const layout = cardLayout();
    const raw = resolveLayout(layout, {});
    const snapshot = JSON.parse(JSON.stringify(raw));
    reflowArtGone(layout, raw);
    expect(raw).toEqual(snapshot); // config/raw never mutated; no reflow = original boxes
  });

  test("auto-width element translates without stretching", () => {
    const layout = cardLayout({ title: { w: null, h: 16, x: 12, snapX: { to: "art", myEdge: "start", toEdge: "end", offset: 10 } } });
    const measured: Measured = { title: { w: 50, h: 16 } };
    const raw = resolveLayout(layout, measured);
    const out = reflowArtGone(layout, raw);
    expect(out.title.x).toBe(10);
    expect(out.title.w).toBe(50); // measured width, not stretched
  });

  test("follower on the anchor's START edge shifts and stretches with it", () => {
    const layout = cardLayout({
      artist: { w: 60, h: 14, x: 12, y: 40, snapX: { to: "title", myEdge: "start", toEdge: "start", offset: 0 } },
    });
    const raw = resolveLayout(layout, {});
    const out = reflowArtGone(layout, raw);
    expect(out.artist.x).toBe(out.title.x); // still rides the title's start
    expect(out.artist.x + out.artist.w).toBe(raw.artist.x + raw.artist.w); // far edge kept
  });

  test("follower on the anchor's END edge stays put (that edge never moved)", () => {
    const layout = cardLayout({
      duration: { w: 40, h: 11, x: 0, snapX: { to: "title", myEdge: "start", toEdge: "end", offset: 8 } },
    });
    const raw = resolveLayout(layout, {});
    const out = reflowArtGone(layout, raw);
    expect(out.duration.x).toBe(raw.duration.x);
    expect(out.duration.w).toBe(raw.duration.w);
  });

  test("mirror: art on the right flushes the end edge and keeps the start edge", () => {
    const layout = v2({
      background: { x: 0, y: 0, w: 400, h: 100 },
      art: { x: 312, y: 0, w: 88, h: 88 },
      title: {
        w: 50,
        h: 16,
        x: 340,
        snapX: { to: "art", myEdge: "end", toEdge: "start", offset: -10 },
      },
    });
    const raw = resolveLayout(layout, {});
    expect(raw.title.x).toBe(252); // art start 312 - 10 - 50
    const out = reflowArtGone(layout, raw);
    expect(out.title.x).toBe(raw.title.x); // start (far) edge unchanged
    expect(out.title.x + out.title.w).toBe(390); // end flushed to widget edge - |offset|
  });

  test("free-positioned elements never move", () => {
    const layout = cardLayout({ album: { x: 200, y: 60, w: 80, h: 12 } });
    const raw = resolveLayout(layout, {});
    const out = reflowArtGone(layout, raw);
    expect(out.album).toEqual(raw.album);
  });
});

describe("migrateToV2", () => {
  test("produces a version:2 config with all elements", () => {
    const out = migrateToV2(defaultConfig);
    expect(out.version).toBe(2);
    expect(out.v2).toBeTruthy();
    for (const id of V2_ELEMENT_IDS) expect(out.v2!.elements[id]).toBeTruthy();
  });

  test("background box matches the legacy widget size; art uses artSize", () => {
    const out = migrateToV2(defaultConfig);
    expect(out.v2!.elements.background.w).toBe(defaultConfig.layout.w);
    expect(out.v2!.elements.background.h).toBe(defaultConfig.layout.h);
    expect(out.v2!.elements.art.w).toBe(defaultConfig.layout.artSize);
  });

  test("carries per-text color and visibility from legacy fields", () => {
    const out = migrateToV2(defaultConfig);
    expect(out.v2!.elements.title.color).toBe(defaultConfig.theme.text.title);
    expect(out.v2!.elements.title.visible).toBe(defaultConfig.fields.title);
    expect(out.v2!.elements.album.visible).toBe(defaultConfig.fields.album);
  });

  test("preserves legacy fields so the design degrades gracefully", () => {
    const out = migrateToV2(defaultConfig);
    expect(out.layout.w).toBe(defaultConfig.layout.w);
    expect(out.theme.bg).toBe(defaultConfig.theme.bg);
  });
});
