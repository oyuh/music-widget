import { test, expect, describe } from "bun:test";
import { resolveLayout } from "../apps/web/src/lib/v2-layout";
import {
  decodeConfig,
  defaultConfig,
  encodeConfig,
  getUsedFonts,
  instanceLabel,
  isBaseId,
  isValidElementId,
  kindOf,
  MAX_PER_KIND,
  migrateToV2,
  nextInstanceId,
  resolveTextProps,
  V2_KINDS,
  type V2Element,
  type WidgetConfig,
} from "../apps/web/src/lib/config";
import { mergeConfig } from "../apps/web/src/lib/config-merge";
import { copyStyle } from "../apps/web/src/lib/element-style";

/** A v2 config with the base 8 elements, ready to have instances bolted on. */
function base(): WidgetConfig {
  return JSON.parse(JSON.stringify(migrateToV2(defaultConfig))) as WidgetConfig;
}

function withElements(extra: Record<string, Partial<V2Element>>): WidgetConfig {
  const cfg = base();
  for (const [id, el] of Object.entries(extra)) {
    cfg.v2!.elements[id] = { ...cfg.v2!.elements[kindOf(id)], ...el } as V2Element;
  }
  return cfg;
}

describe("instance ids", () => {
  test("kindOf strips the instance suffix", () => {
    expect(kindOf("title")).toBe("title");
    expect(kindOf("title#2")).toBe("title");
    expect(kindOf("background#3")).toBe("background");
  });

  test("only the bare id is the base instance", () => {
    expect(isBaseId("art")).toBe(true);
    expect(isBaseId("art#2")).toBe(false);
  });

  test("validation accepts known kinds within the cap and nothing else", () => {
    expect(isValidElementId("title")).toBe(true);
    expect(isValidElementId("title#2")).toBe(true);
    expect(isValidElementId(`title#${MAX_PER_KIND}`)).toBe(true);
    expect(isValidElementId(`title#${MAX_PER_KIND + 1}`)).toBe(false);
    expect(isValidElementId("title#1")).toBe(false); // the base id has no suffix
    expect(isValidElementId("title#0")).toBe(false);
    expect(isValidElementId("bogus")).toBe(false);
    expect(isValidElementId("bogus#2")).toBe(false);
    expect(isValidElementId("__proto__")).toBe(false);
    expect(isValidElementId("title#2#3")).toBe(false);
  });

  test("nextInstanceId walks up to the cap and then gives up", () => {
    const els = base().v2!.elements;
    expect(nextInstanceId(els, "title")).toBe("title#2");
    els["title#2"] = els.title;
    expect(nextInstanceId(els, "title")).toBe("title#3");
    for (let n = 3; n <= MAX_PER_KIND; n++) els[`title#${n}`] = els.title;
    expect(nextInstanceId(els, "title")).toBeNull();
  });

  test("labels number the extras and leave the first one alone", () => {
    expect(instanceLabel("title", "Title")).toBe("Title");
    expect(instanceLabel("title#2", "Title")).toBe("Title 2");
  });
});

describe("mergeConfig with instances", () => {
  test("a design with no extras decodes to exactly the base elements", () => {
    const merged = mergeConfig(base());
    expect(Object.keys(merged.v2!.elements).sort()).toEqual([...V2_KINDS].sort());
  });

  test("a valid extra instance survives and inherits its kind's defaults", () => {
    const merged = mergeConfig(withElements({ "background#2": { x: 20, y: 30, w: 100, h: 40 } }));
    const el = merged.v2!.elements["background#2"];
    expect(el).toBeTruthy();
    expect(el.x).toBe(20);
    expect(el.w).toBe(100);
    // Unspecified fields fall back to the kind's base element, not to nothing.
    expect(el.radius).toBe(merged.v2!.elements.background.radius);
  });

  test("unknown kinds and out-of-range suffixes are dropped, not trusted", () => {
    const cfg = base();
    // Hand-edited hash: none of these are ids the editor can produce.
    (cfg.v2!.elements as Record<string, unknown>)["bogus#2"] = { ...cfg.v2!.elements.title };
    (cfg.v2!.elements as Record<string, unknown>)[`title#${MAX_PER_KIND + 1}`] = { ...cfg.v2!.elements.title };
    const merged = mergeConfig(cfg);
    expect(merged.v2!.elements["bogus#2"]).toBeUndefined();
    expect(merged.v2!.elements[`title#${MAX_PER_KIND + 1}`]).toBeUndefined();
  });

  test("no kind can exceed the cap", () => {
    const extra: Record<string, Partial<V2Element>> = {};
    for (let n = 2; n <= MAX_PER_KIND + 2; n++) extra[`art#${n}`] = { x: n };
    const merged = mergeConfig(withElements(extra));
    const arts = Object.keys(merged.v2!.elements).filter((id) => kindOf(id) === "art");
    expect(arts.length).toBe(MAX_PER_KIND);
  });

  test("a snap pointing at a missing element is freed instead of pinning it at 0", () => {
    const cfg = base();
    cfg.v2!.elements.title.snapX = { to: "art#3", myEdge: "start", toEdge: "end", offset: 8 };
    const merged = mergeConfig(cfg);
    expect(merged.v2!.elements.title.snapX).toBeNull();
  });

  test("a snap to a surviving extra instance is kept", () => {
    const cfg = withElements({ "art#2": { x: 100, w: 40, h: 40 } });
    cfg.v2!.elements.title.snapX = { to: "art#2", myEdge: "start", toEdge: "end", offset: 8 };
    const merged = mergeConfig(cfg);
    expect(merged.v2!.elements.title.snapX?.to).toBe("art#2");
  });
});

describe("layout with instances", () => {
  test("an element can snap to an extra instance", () => {
    const cfg = withElements({ "art#2": { x: 200, y: 0, w: 60, h: 60, snapX: null, snapY: null } });
    cfg.v2!.elements.title.snapX = { to: "art#2", myEdge: "start", toEdge: "end", offset: 10 };
    const boxes = resolveLayout(cfg.v2!, {});
    expect(boxes.title.x).toBe(270); // 200 + 60 + 10
  });

  test("every instance gets a resolved box", () => {
    const cfg = withElements({ "title#2": { x: 5, y: 5 }, "background#2": { x: 1, y: 2, w: 10, h: 10 } });
    const boxes = resolveLayout(cfg.v2!, {});
    expect(boxes["title#2"]).toBeTruthy();
    expect(boxes["background#2"]).toEqual({ x: 1, y: 2, w: 10, h: 10 });
  });
});

describe("per-instance typography", () => {
  test("an element with no override reads the kind's theme settings", () => {
    const cfg = base();
    cfg.theme.textSize!.title = 40;
    cfg.theme.textStyle!.title.italic = true;
    const r = resolveTextProps(cfg, "title");
    expect(r.size).toBe(40);
    expect(r.italic).toBe(true);
  });

  test("an override wins over the theme, per field", () => {
    const cfg = withElements({ "title#2": { text: { size: 12, bold: false } } });
    cfg.theme.textSize!.title = 40;
    cfg.theme.textStyle!.title.bold = true;
    cfg.theme.textTransform!.title = "uppercase";
    const r = resolveTextProps(cfg, "title#2");
    expect(r.size).toBe(12);
    expect(r.bold).toBe(false);
    // Untouched fields still follow the kind.
    expect(r.transform).toBe("uppercase");
    // …and the original is unaffected.
    expect(resolveTextProps(cfg, "title").size).toBe(40);
  });

  test('font: "" means the global font, absent means the kind\'s font', () => {
    const cfg = withElements({ "title#2": { text: { font: "" } }, "title#3": {} });
    cfg.theme.font = "Inter";
    cfg.theme.textFont!.title = "Roboto";
    expect(resolveTextProps(cfg, "title").font).toBe("Roboto");
    expect(resolveTextProps(cfg, "title#2").font).toBe("Inter");
    expect(resolveTextProps(cfg, "title#3").font).toBe("Roboto");
  });

  test("fonts only a duplicate uses still get loaded", () => {
    const cfg = withElements({ "artist#2": { text: { font: "Lobster" } } });
    expect(getUsedFonts(cfg)).toContain("Lobster");
  });
});

describe("encoded URL size", () => {
  /** What the widget actually renders from, for both sides of a comparison. */
  const rendered = (cfg: WidgetConfig) => JSON.stringify(mergeConfig(cfg).v2);
  const roundTrip = (cfg: WidgetConfig) => decodeConfig(encodeConfig(cfg)) as WidgetConfig;

  test("encoding drops baseline fields but decodes to the same widget", () => {
    const cfg = base();
    cfg.v2!.elements.title.x = 99;
    const out = roundTrip(cfg);
    // The trimmed payload really is smaller...
    expect(encodeConfig(cfg).length).toBeLessThan(
      encodeConfig({ ...cfg, version: 1 } as WidgetConfig).length,
    );
    // ...and still renders identically once merged.
    expect(rendered(out)).toBe(rendered(cfg));
    expect(mergeConfig(out).v2!.elements.title.x).toBe(99);
  });

  test("extra instances survive the trim", () => {
    const cfg = withElements({
      "background#2": { x: 20, y: 30, w: 100, h: 40, tint: { color: "#000000", opacity: 50 } },
      "title#2": { x: 5, text: { size: 33, font: "Lobster" } },
    });
    const out = roundTrip(cfg);
    expect(rendered(out)).toBe(rendered(cfg));
    const els = mergeConfig(out).v2!.elements;
    expect(els["background#2"].tint).toEqual({ color: "#000000", opacity: 50 });
    expect(els["title#2"].text).toEqual({ size: 33, font: "Lobster" });
  });

  test("a maxed-out design still round-trips", () => {
    const extra: Record<string, Partial<V2Element>> = {};
    for (const kind of V2_KINDS) {
      for (let n = 2; n <= MAX_PER_KIND; n++) {
        extra[`${kind}#${n}`] = {
          x: n * 7,
          y: n * 5,
          z: n,
          stroke: { enabled: true, width: 4, align: "outside", opacity: 80, color: "#654321" },
          tint: { color: "#123456", opacity: 60 },
        };
      }
    }
    const cfg = withElements(extra);
    const merged = mergeConfig(roundTrip(cfg));
    expect(Object.keys(merged.v2!.elements).length).toBe(V2_KINDS.length * MAX_PER_KIND);
    expect(rendered(merged)).toBe(rendered(cfg));
  });

  test("a design saved before the trim existed still decodes", () => {
    // Every field spelled out, i.e. what older share links look like.
    const full = base();
    const hash = btoa(unescape(encodeURIComponent(JSON.stringify(full))))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
    expect(rendered(decodeConfig(hash) as WidgetConfig)).toBe(rendered(full));
  });
});

describe("copy style between instances", () => {
  const el = (cfg: WidgetConfig, id: string) => cfg.v2!.elements[id];

  test("takes paint but leaves placement alone", () => {
    const cfg = withElements({ "title#2": { x: 200, y: 150, z: 9, w: 300, color: "#ff0000" } });
    el(cfg, "title").color = "#00ff00";
    el(cfg, "title").stroke = { enabled: true, width: 5, align: "outside", opacity: 70, color: "#0000ff" };
    el(cfg, "title").shadow = { ...el(cfg, "title").shadow, enabled: true, blur: 21 };

    expect(copyStyle(cfg, "title#2", "title")).toBe(true);

    const copy = el(cfg, "title#2");
    expect(copy.color).toBe("#00ff00");
    expect(copy.stroke?.width).toBe(5);
    expect(copy.shadow.blur).toBe(21);
    // Placement untouched: that's what makes the two separate elements.
    expect(copy.x).toBe(200);
    expect(copy.y).toBe(150);
    expect(copy.z).toBe(9);
    expect(copy.w).toBe(300);
  });

  test("copying is a snapshot, not a link: editing the source later doesn't follow", () => {
    const cfg = withElements({ "background#2": {} });
    el(cfg, "background").shadow.blur = 30;
    copyStyle(cfg, "background#2", "background");
    el(cfg, "background").shadow.blur = 3;
    expect(el(cfg, "background#2").shadow.blur).toBe(30);
  });

  test("clears a field the source doesn't have, instead of keeping the old one", () => {
    const cfg = withElements({ "background#2": { tint: { color: "#ff0000", opacity: 80 } } });
    delete el(cfg, "background").tint;
    copyStyle(cfg, "background#2", "background");
    expect(el(cfg, "background#2").tint).toBeUndefined();
  });

  test("typography copies onto a duplicate as its own override", () => {
    const cfg = withElements({ "title#2": { text: { size: 9 } } });
    cfg.theme.textSize!.title = 44;
    cfg.theme.textStyle!.title.italic = true;
    copyStyle(cfg, "title#2", "title");
    expect(resolveTextProps(cfg, "title#2").size).toBe(44);
    expect(resolveTextProps(cfg, "title#2").italic).toBe(true);
    expect(resolveTextProps(cfg, "title").size).toBe(44);
  });

  test("copying onto the base writes the theme, so its controls keep working", () => {
    const cfg = withElements({ "artist#2": { text: { size: 51, bold: true } } });
    copyStyle(cfg, "artist", "artist#2");
    expect(resolveTextProps(cfg, "artist").size).toBe(51);
    expect(cfg.theme.textSize!.artist).toBe(51);
    // No leftover override shadowing the theme the base instance edits.
    expect(el(cfg, "artist").text).toBeUndefined();
  });

  test("a source following the global font doesn't pin the target to a name", () => {
    const cfg = withElements({ "title#2": { text: { font: "" } } });
    cfg.theme.font = "Inter";
    copyStyle(cfg, "title", "title#2");
    // "" is an intent, not a family: the base keeps following the global font.
    expect(cfg.theme.textFont?.title).toBeUndefined();
    expect(resolveTextProps(cfg, "title").font).toBe("Inter");
    cfg.theme.font = "Lobster";
    expect(resolveTextProps(cfg, "title").font).toBe("Lobster");
  });

  test("refuses across kinds, onto itself, or from something missing", () => {
    const cfg = withElements({ "title#2": {} });
    expect(copyStyle(cfg, "title#2", "artist")).toBe(false);
    expect(copyStyle(cfg, "title#2", "title#2")).toBe(false);
    expect(copyStyle(cfg, "title#2", "title#3")).toBe(false);
  });
});

describe("background tint", () => {
  test("absent on a config that never set one, so old designs are unchanged", () => {
    expect(base().v2!.elements.background.tint).toBeUndefined();
    expect(mergeConfig(base()).v2!.elements.background.tint).toBeUndefined();
  });

  test("survives a merge with its color and strength", () => {
    const cfg = base();
    cfg.v2!.elements.background.tint = { color: "#000000", opacity: 40 };
    expect(mergeConfig(cfg).v2!.elements.background.tint).toEqual({ color: "#000000", opacity: 40 });
  });
});
