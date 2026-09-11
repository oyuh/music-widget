import {
  scopeCss,
  type V2Animation,
  type V2AnimationEasing,
  type V2AnimationTrigger,
  type V2CustomAnimation,
  type V2VisualAnimationFrame,
} from "./config";
import { backOut, cubicOut, elasticOut, quintOut, sineOut } from "svelte/easing";

export const MAX_ELEMENT_ANIMATIONS = 2;
export const MAX_CUSTOM_ANIMATIONS = 6;
export const CUSTOM_ANIMATION_SOURCE_MAX = 2000;
export const CUSTOM_ANIMATION_TOTAL_MAX = 4000;
export const MAX_STAGGER_WINDOW_MS = 700;

export const ANIMATION_TRIGGERS: { value: V2AnimationTrigger; label: string }[] = [
  { value: "widget-load", label: "Widget load" },
  { value: "track-change", label: "Song change" },
  { value: "playback", label: "Playing" },
  { value: "paused", label: "Paused / stopped" },
];

export const ANIMATION_EASINGS: { value: V2AnimationEasing; label: string }[] = [
  { value: "ease-out", label: "Ease out" },
  { value: "ease-in", label: "Ease in" },
  { value: "ease-in-out", label: "Ease in and out" },
  { value: "spring", label: "Spring" },
  { value: "overshoot", label: "Overshoot" },
  { value: "linear", label: "Linear" },
  { value: "sineOut", label: "Sine out" },
  { value: "cubicOut", label: "Cubic out" },
  { value: "quintOut", label: "Quint out" },
  { value: "backOut", label: "Back out" },
  { value: "elasticOut", label: "Elastic out" },
];

export const ANIMATION_EFFECTS = [
  { value: "fade", label: "Fade", targets: "all" },
  { value: "slide", label: "Slide", targets: "all" },
  { value: "pop", label: "Pop", targets: "all" },
  { value: "blur", label: "Blur", targets: "all" },
  { value: "zoom", label: "Zoom", targets: "image" },
  { value: "tilt", label: "Tilt", targets: "image" },
  { value: "flip", label: "Flip", targets: "image" },
  { value: "letter-fade", label: "Letter fade", targets: "text" },
  { value: "letter-rise", label: "Letter rise", targets: "text" },
  { value: "letter-blur", label: "Letter blur", targets: "text" },
] as const;

const BUILTIN_EFFECTS = new Set<string>(ANIMATION_EFFECTS.map((effect) => effect.value));
const TRIGGERS = new Set<string>(ANIMATION_TRIGGERS.map((trigger) => trigger.value));
const EASINGS = new Set<string>(ANIMATION_EASINGS.map((easing) => easing.value));
const DIRECTIONS = new Set(["up", "down", "left", "right"]);
const CUSTOM_ID = /^a[1-9]\d{0,2}$/;

export const DEFAULT_VISUAL_FROM: V2VisualAnimationFrame = {
  opacity: 0,
  x: 0,
  y: 12,
  scale: 96,
  rotate: 0,
  blur: 0,
};

export const DEFAULT_VISUAL_TO: V2VisualAnimationFrame = {
  opacity: 100,
  x: 0,
  y: 0,
  scale: 100,
  rotate: 0,
  blur: 0,
};

const number = (value: unknown, fallback: number, min: number, max: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
};

const effect = (value: unknown, fallback: string) => {
  const id = String(value ?? "");
  return BUILTIN_EFFECTS.has(id) || /^custom:a[1-9]\d{0,2}$/.test(id) || id === "none" ? id : fallback;
};

export function createAnimation(trigger: V2AnimationTrigger = "track-change"): V2Animation {
  const paired = trigger === "playback" || trigger === "paused";
  return {
    trigger,
    effect: "fade",
    exitEffect: paired ? "fade" : "none",
    durationMs: 350,
    exitDurationMs: 220,
    delayMs: 0,
    exitDelayMs: 0,
    easing: "ease-out",
    exitEasing: "ease-in",
    direction: "up",
    distance: 16,
    staggerMs: 35,
    reverseLetters: false,
  };
}

/** Normalize animation settings from a hand-edited URL hash. */
export function normalizeElementAnimations(value: unknown): V2Animation[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: V2Animation[] = [];
  for (const raw of value.slice(0, MAX_ELEMENT_ANIMATIONS)) {
    if (!raw || typeof raw !== "object") continue;
    const input = raw as Record<string, unknown>;
    const trigger = TRIGGERS.has(String(input.trigger))
      ? (input.trigger as V2AnimationTrigger)
      : "track-change";
    const base = createAnimation(trigger);
    out.push({
      trigger,
      effect: effect(input.effect, base.effect),
      exitEffect: effect(input.exitEffect, base.exitEffect),
      durationMs: number(input.durationMs, base.durationMs, 0, 5000),
      exitDurationMs: number(input.exitDurationMs, base.exitDurationMs, 0, 5000),
      delayMs: number(input.delayMs, base.delayMs, 0, 3000),
      exitDelayMs: number(input.exitDelayMs, base.exitDelayMs, 0, 3000),
      easing: EASINGS.has(String(input.easing)) ? (input.easing as V2AnimationEasing) : base.easing,
      exitEasing: EASINGS.has(String(input.exitEasing))
        ? (input.exitEasing as V2AnimationEasing)
        : base.exitEasing,
      direction: DIRECTIONS.has(String(input.direction))
        ? (input.direction as V2Animation["direction"])
        : base.direction,
      distance: number(input.distance, base.distance, 0, 120),
      staggerMs: number(input.staggerMs, base.staggerMs, 0, 150),
      reverseLetters: !!input.reverseLetters,
    });
  }
  return out.length ? out : undefined;
}

export function normalizeCustomAnimations(value: unknown): V2CustomAnimation[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: V2CustomAnimation[] = [];
  const seen = new Set<string>();
  let remaining = CUSTOM_ANIMATION_TOTAL_MAX;
  for (const raw of value.slice(0, MAX_CUSTOM_ANIMATIONS)) {
    if (!raw || typeof raw !== "object") continue;
    const input = raw as Record<string, unknown>;
    const id = String(input.id ?? "");
    if (!CUSTOM_ID.test(id) || seen.has(id)) continue;
    seen.add(id);
    const type = input.type === "visual" ? "visual" : input.type === "js" ? "js" : "css";
    const source = type === "visual"
      ? ""
      : String(input.source ?? "").slice(0, Math.min(CUSTOM_ANIMATION_SOURCE_MAX, remaining));
    remaining -= source.length;
    out.push({
      id,
      name: String(input.name ?? "Custom animation").trim().slice(0, 32) || "Custom animation",
      type,
      source: type === "visual" ? "" : source,
      ...(type === "visual"
        ? {
            from: normalizeVisualFrame(input.from, DEFAULT_VISUAL_FROM),
            to: normalizeVisualFrame(input.to, DEFAULT_VISUAL_TO),
          }
        : {}),
    });
  }
  return out.length ? out : undefined;
}

function normalizeVisualFrame(value: unknown, fallback: V2VisualAnimationFrame): V2VisualAnimationFrame {
  const input = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    opacity: number(input.opacity, fallback.opacity, 0, 100),
    x: number(input.x, fallback.x, -240, 240),
    y: number(input.y, fallback.y, -240, 240),
    scale: number(input.scale, fallback.scale, 0, 200),
    rotate: number(input.rotate, fallback.rotate, -360, 360),
    blur: number(input.blur, fallback.blur, 0, 40),
  };
}

export function nextCustomAnimationId(definitions: V2CustomAnimation[] | undefined): string | null {
  const used = new Set((definitions ?? []).map((definition) => definition.id));
  for (let i = 1; i <= 999; i++) if (!used.has(`a${i}`)) return `a${i}`;
  return null;
}

export function createCustomAnimation(type: "visual" | "css" | "js", id: string): V2CustomAnimation {
  if (type === "visual") {
    return {
      id,
      name: "Custom reveal",
      type,
      source: "",
      from: { ...DEFAULT_VISUAL_FROM },
      to: { ...DEFAULT_VISUAL_TO },
    };
  }
  return type === "css"
    ? {
        id,
        name: "Custom fade",
        type,
        source: "@keyframes custom-fade {\n  from { opacity: 0; transform: scale(.96); }\n  to { opacity: 1; transform: scale(1); }\n}",
      }
    : {
        id,
        name: "Custom motion",
        type,
        source: 'return [\n  { opacity: 0, transform: "translateY(12px)" },\n  { opacity: 1, transform: "translateY(0)" }\n];',
      };
}

export function visualKeyframes(definition: V2CustomAnimation): Keyframe[] | null {
  if (definition.type !== "visual") return null;
  const from = definition.from ?? DEFAULT_VISUAL_FROM;
  const to = definition.to ?? DEFAULT_VISUAL_TO;
  const keyframe = (frame: V2VisualAnimationFrame): Keyframe => ({
    opacity: frame.opacity / 100,
    transform: `translate3d(${frame.x}px,${frame.y}px,0) rotate(${frame.rotate}deg) scale(${frame.scale / 100})`,
    filter: `blur(${frame.blur}px)`,
  });
  return [keyframe(from), keyframe(to)];
}

export function customEffectId(id: string) {
  return `custom:${id}`;
}

export function isLetterEffect(id: string): boolean {
  return id.startsWith("letter-");
}

export function hasLetterAnimation(animations: V2Animation[] | undefined): boolean {
  return !!animations?.some(
    (animation) => isLetterEffect(animation.effect) || isLetterEffect(animation.exitEffect),
  );
}

export function splitGraphemes(text: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    return Array.from(segmenter.segment(text), (part) => part.segment);
  }
  return Array.from(text);
}

export function cssKeyframeName(source: string): string | null {
  return /@(?:-\w+-)?keyframes\s+([a-z_][\w-]*)/i.exec(source)?.[1] ?? null;
}

/** Return the first complete keyframe rule and ignore unrelated CSS. */
export function cssKeyframeBlock(source: string): string | null {
  const match = /@(?:-\w+-)?keyframes\s+[a-z_][\w-]*/i.exec(source);
  if (!match || match.index === undefined) return null;
  const start = match.index;
  let open = source.indexOf("{", start + match[0].length);
  if (open < 0) return null;
  let depth = 0;
  let quote = "";
  let comment = false;
  for (let index = open; index < source.length; index++) {
    const char = source[index];
    const next = source[index + 1];
    if (comment) {
      if (char === "*" && next === "/") {
        comment = false;
        index++;
      }
      continue;
    }
    if (quote) {
      if (char === "\\") index++;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === "/" && next === "*") {
      comment = true;
      index++;
    } else if (char === '"' || char === "'") quote = char;
    else if (char === "{") depth++;
    else if (char === "}" && --depth === 0) return source.slice(start, index + 1);
  }
  return null;
}

function customCssRuntime(definition: V2CustomAnimation): { name: string; css: string } | null {
  const block = cssKeyframeBlock(definition.source);
  const authoredName = block ? cssKeyframeName(block) : null;
  if (!authoredName) return null;
  let hash = 2166136261;
  for (let index = 0; index < block!.length; index++) {
    hash ^= block!.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const name = `mw-custom-${definition.id}-${(hash >>> 0).toString(36)}-${authoredName.slice(0, 48)}`;
  return {
    name,
    css: block!.replace(
      /(@(?:-\w+-)?keyframes\s+)([a-z_][\w-]*)/i,
      `$1${name}`,
    ),
  };
}

export function customAnimationCss(definitions: V2CustomAnimation[] | undefined): string {
  return (definitions ?? [])
    .filter((definition) => definition.type === "css")
    .map(customCssRuntime)
    .filter((runtime): runtime is { name: string; css: string } => !!runtime)
    .map((runtime) => scopeCss(runtime.css))
    .filter(Boolean)
    .join("\n");
}

const sampledEasing = (easing: (value: number) => number) =>
  `linear(${Array.from({ length: 31 }, (_, index) => Number(easing(index / 30).toFixed(5))).join(",")})`;

const CSS_EASING: Record<V2AnimationEasing, string> = {
  linear: "linear",
  "ease-in": "cubic-bezier(.4,0,1,1)",
  "ease-out": "cubic-bezier(.16,1,.3,1)",
  "ease-in-out": "cubic-bezier(.65,0,.35,1)",
  spring: "linear(0, .006, .025 2.8%, .101 6.1%, .539 18.9%, .721 25.3%, .849 33.2%, .937 42.4%, .984 53.5%, 1.006 66.1%, 1.01 77.6%, 1)",
  overshoot: "cubic-bezier(.34,1.56,.64,1)",
  sineOut: sampledEasing(sineOut),
  cubicOut: sampledEasing(cubicOut),
  quintOut: sampledEasing(quintOut),
  backOut: sampledEasing(backOut),
  elasticOut: sampledEasing(elasticOut),
};

function translate(direction: V2Animation["direction"], distance: number) {
  if (direction === "up") return `translate3d(0,${distance}px,0)`;
  if (direction === "down") return `translate3d(0,-${distance}px,0)`;
  if (direction === "left") return `translate3d(${distance}px,0,0)`;
  return `translate3d(-${distance}px,0,0)`;
}

function builtinKeyframes(id: string, animation: V2Animation): Keyframe[] | null {
  const move = translate(animation.direction, animation.distance);
  switch (id) {
    case "fade":
      return [{ opacity: 0 }, { opacity: 1 }];
    case "slide":
      return [{ opacity: 0, transform: move }, { opacity: 1, transform: "translate3d(0,0,0)" }];
    case "pop":
      return [{ opacity: 0, transform: "scale(.82)" }, { opacity: 1, transform: "scale(1)" }];
    case "blur":
      return [{ opacity: 0, filter: "blur(12px)" }, { opacity: 1, filter: "blur(0)" }];
    case "zoom":
      return [{ opacity: 0, transform: "scale(1.16)" }, { opacity: 1, transform: "scale(1)" }];
    case "tilt":
      return [{ opacity: 0, transform: `${move} rotate(-7deg) scale(.96)` }, { opacity: 1, transform: "translate3d(0,0,0) rotate(0) scale(1)" }];
    case "flip":
      return animation.direction === "up" || animation.direction === "down"
        ? [{ opacity: 0, transform: `perspective(500px) rotateX(${animation.direction === "up" ? 70 : -70}deg)` }, { opacity: 1, transform: "perspective(500px) rotateX(0)" }]
        : [{ opacity: 0, transform: `perspective(500px) rotateY(${animation.direction === "left" ? 70 : -70}deg)` }, { opacity: 1, transform: "perspective(500px) rotateY(0)" }];
    case "letter-fade":
      return [{ opacity: 0 }, { opacity: 1 }];
    case "letter-rise":
      return [{ opacity: 0, transform: `translate3d(0,${Math.max(4, animation.distance)}px,0)` }, { opacity: 1, transform: "translate3d(0,0,0)" }];
    case "letter-blur":
      return [{ opacity: 0, filter: "blur(8px)", transform: "scale(.92)" }, { opacity: 1, filter: "blur(0)", transform: "scale(1)" }];
    default:
      return null;
  }
}

function reverseKeyframes(frames: Keyframe[]): Keyframe[] {
  return [...frames].reverse().map((frame) => {
    if (typeof frame.offset !== "number") return frame;
    return { ...frame, offset: 1 - frame.offset };
  });
}

const SAFE_FRAME_KEYS = new Set(["opacity", "transform", "filter", "offset"]);

/** Strip anything a custom script returns that is not safe animation data. */
export function validateCustomKeyframes(value: unknown): Keyframe[] | null {
  if (!Array.isArray(value) || value.length < 2 || value.length > 32) return null;
  const frames: Keyframe[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const frame: Record<string, string | number> = {};
    for (const [key, rawValue] of Object.entries(raw as Record<string, unknown>)) {
      if (!SAFE_FRAME_KEYS.has(key)) continue;
      if (key === "opacity") {
        const opacity = Number(rawValue);
        if (Number.isFinite(opacity)) frame.opacity = Math.min(1, Math.max(0, opacity));
      } else if (key === "offset") {
        const offset = Number(rawValue);
        if (Number.isFinite(offset)) frame.offset = Math.min(1, Math.max(0, offset));
      } else if (typeof rawValue === "string" && rawValue.length <= 200 && !/url\s*\(/i.test(rawValue)) {
        frame[key] = rawValue;
      }
    }
    if (!Object.keys(frame).length) return null;
    frames.push(frame as Keyframe);
  }
  return frames;
}

type SandboxRequest = {
  source: string;
  context: { trigger: V2AnimationTrigger; phase: "enter" | "exit"; element: string };
};

let sandboxFrame: HTMLIFrameElement | null = null;
let sandboxReady: Promise<void> | null = null;
let sandboxSequence = 0;
const sandboxJobs = new Map<number, { resolve: (value: unknown) => void; timer: ReturnType<typeof setTimeout> }>();

function sandboxHtml() {
  const workerSource = `self.onmessage=function(event){try{var fn=new Function("context","\\\"use strict\\\";\\n"+event.data.source);var value=fn(Object.freeze(event.data.context));self.postMessage({ok:true,value:value});}catch(error){self.postMessage({ok:false,error:error instanceof Error?error.message:String(error)});}};`;
  const frameScript = `
    const workerSource=${JSON.stringify(workerSource)};
    addEventListener("message",event=>{
      if(event.source!==parent||event.data?.type!=="mw-animation-run")return;
      const blob=new Blob([workerSource],{type:"text/javascript"});
      const url=URL.createObjectURL(blob);
      const worker=new Worker(url);
      let done=false;
      const finish=value=>{if(done)return;done=true;clearTimeout(timer);worker.terminate();URL.revokeObjectURL(url);parent.postMessage({type:"mw-animation-result",id:event.data.id,value},"*");};
      const timer=setTimeout(()=>finish(null),80);
      worker.onmessage=message=>finish(message.data?.ok?message.data.value:null);
      worker.onerror=()=>finish(null);
      worker.postMessage(event.data.request);
    });
    parent.postMessage({type:"mw-animation-ready"},"*");
  `;
  return `<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' blob:; worker-src blob:; connect-src 'none'; img-src 'none'"><script>${frameScript.replace(/<\/script/gi, "<\\/script")}</script>`;
}

function ensureSandbox(): Promise<void> {
  if (sandboxReady) return sandboxReady;
  sandboxReady = new Promise((resolve) => {
    const frame = document.createElement("iframe");
    frame.hidden = true;
    frame.sandbox.add("allow-scripts");
    frame.title = "Custom animation sandbox";
    frame.srcdoc = sandboxHtml();
    sandboxFrame = frame;
    const readyTimer = setTimeout(resolve, 250);
    const onMessage = (event: MessageEvent) => {
      if (event.source !== sandboxFrame?.contentWindow) return;
      if (event.data?.type === "mw-animation-ready") {
        clearTimeout(readyTimer);
        resolve();
        return;
      }
      if (event.data?.type !== "mw-animation-result") return;
      const job = sandboxJobs.get(event.data.id);
      if (!job) return;
      clearTimeout(job.timer);
      sandboxJobs.delete(event.data.id);
      job.resolve(event.data.value);
    };
    window.addEventListener("message", onMessage);
    document.body.appendChild(frame);
  });
  return sandboxReady;
}

async function runCustomScript(request: SandboxRequest): Promise<Keyframe[] | null> {
  if (typeof document === "undefined" || request.source.length > CUSTOM_ANIMATION_SOURCE_MAX) return null;
  await ensureSandbox();
  const id = ++sandboxSequence;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      sandboxJobs.delete(id);
      resolve(null);
    }, 250);
    sandboxJobs.set(id, { resolve: (value) => resolve(validateCustomKeyframes(value)), timer });
    sandboxFrame?.contentWindow?.postMessage({ type: "mw-animation-run", id, request }, "*");
  });
}

export type MotionState = { trackKey: string; playing: boolean; preview: boolean };
export type MotionParams = {
  id: string;
  slot: number;
  animation: V2Animation;
  customAnimations: V2CustomAnimation[] | undefined;
  state: MotionState;
};

function definitionFor(effectId: string, definitions: V2CustomAnimation[] | undefined) {
  if (!effectId.startsWith("custom:")) return null;
  const id = effectId.slice(7);
  return definitions?.find((definition) => definition.id === id) ?? null;
}

/** Svelte action that runs one interruptible motion layer. */
export function motion(node: HTMLElement, initial: MotionParams) {
  let params = initial;
  let first = true;
  let previousTrack = initial.state.trackKey;
  let previousPlaying = initial.state.playing;
  let generation = 0;
  let active: Animation[] = [];
  let previousSettings = JSON.stringify({ animation: initial.animation, custom: initial.customAnimations });

  const reset = (capture = false) => {
    const current = new Map<HTMLElement, Keyframe>();
    const captureTarget = (target: HTMLElement) => {
      if (!capture || current.has(target)) return;
      const style = getComputedStyle(target);
      current.set(target, {
        opacity: style.opacity,
        transform: style.transform,
        filter: style.filter,
      });
    };
    active.forEach((animation) => {
      const target = (animation.effect as KeyframeEffect | null)?.target;
      if (target instanceof HTMLElement) captureTarget(target);
    });
    if (node.style.animation) captureTarget(node);
    generation++;
    active.forEach((animation) => animation.cancel());
    active = [];
    node.style.animation = "";
    node.style.willChange = "";
    node.style.visibility = "";
    return current;
  };

  const play = async (effectId: string, phase: "enter" | "exit", preserve = false) => {
    const current = reset(preserve);
    if (effectId === "none") return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      node.style.visibility = phase === "exit" ? "hidden" : "";
      return;
    }
    const run = generation;
    const binding = params.animation;
    const exiting = phase === "exit";
    const duration = exiting ? binding.exitDurationMs : binding.durationMs;
    const baseDelay = exiting ? binding.exitDelayMs : binding.delayMs;
    const easing = CSS_EASING[exiting ? binding.exitEasing : binding.easing];
    const definition = definitionFor(effectId, params.customAnimations);

    if (definition?.type === "css") {
      const runtime = customCssRuntime(definition);
      if (!runtime) return;
      node.style.willChange = "transform, opacity, filter";
      node.style.animation = `${runtime.name} ${duration}ms ${easing} ${baseDelay}ms 1 ${exiting ? "reverse" : "normal"} both`;
      setTimeout(() => {
        if (run === generation) node.style.willChange = "";
      }, duration + baseDelay);
      return;
    }

    let frames = definition?.type === "js"
      ? await runCustomScript({ source: definition.source, context: { trigger: binding.trigger, phase, element: params.id } })
      : definition?.type === "visual"
        ? visualKeyframes(definition)
        : builtinKeyframes(effectId, binding);
    if (!frames || run !== generation) return;
    if (exiting) frames = reverseKeyframes(frames);

    const letterEffect = isLetterEffect(effectId);
    const targets = letterEffect
      ? Array.from(node.querySelectorAll<HTMLElement>("[data-motion-letter]"))
      : [node];
    if (!targets.length) return;
    node.style.willChange = letterEffect ? "" : "transform, opacity, filter";
    const letterCount = Math.max(1, ...targets.map((target) => Number(target.dataset.motionLetter ?? 0) + 1));
    const stagger = letterCount > 1
      ? Math.min(binding.staggerMs, MAX_STAGGER_WINDOW_MS / (letterCount - 1))
      : 0;

    active = targets.map((target) => {
      const rawIndex = Number(target.dataset.motionLetter ?? 0);
      const index = binding.reverseLetters ? letterCount - 1 - rawIndex : rawIndex;
      if (letterEffect) target.style.willChange = "transform, opacity, filter";
      const targetFrames = current.has(target)
        ? [{ ...frames![0], ...current.get(target) }, ...frames!.slice(1)]
        : frames!;
      return target.animate(targetFrames, {
        duration,
        delay: baseDelay + index * stagger,
        easing,
        fill: "both",
      });
    });
    void Promise.allSettled(active.map((animation) => animation.finished)).then(() => {
      if (run !== generation) return;
      node.style.willChange = "";
      targets.forEach((target) => (target.style.willChange = ""));
    });
  };

  const update = (next: MotionParams) => {
    params = next;
    const { animation, state } = params;
    const settings = JSON.stringify({ animation, custom: params.customAnimations });
    let played = false;
    if (first) {
      first = false;
      if (animation.trigger === "widget-load") {
        played = true;
        void play(animation.effect, "enter");
      } else if (animation.trigger === "playback" && state.playing) {
        played = true;
        void play(animation.effect, "enter");
      } else if (animation.trigger === "paused" && !state.playing) {
        played = true;
        void play(animation.effect, "enter");
      }
    } else {
      if (animation.trigger === "track-change" && state.trackKey !== previousTrack) {
        played = true;
        void play(animation.effect, "enter");
      }
      if (state.playing !== previousPlaying) {
        if (animation.trigger === "playback") {
          played = true;
          void play(
            state.playing ? animation.effect : animation.exitEffect,
            state.playing ? "enter" : "exit",
            true,
          );
        } else if (animation.trigger === "paused") {
          played = true;
          void play(
            state.playing ? animation.exitEffect : animation.effect,
            state.playing ? "exit" : "enter",
            true,
          );
        }
      }
    }
    if (!played && settings !== previousSettings) reset();
    previousSettings = settings;
    previousTrack = state.trackKey;
    previousPlaying = state.playing;
  };

  const preview = (event: Event) => {
    const detail = (event as CustomEvent<{ id: string; slot: number }>).detail;
    if (!params.state.preview || detail?.id !== params.id || detail.slot !== params.slot) return;
    void play(params.animation.effect, "enter");
  };
  window.addEventListener("mw:preview-animation", preview);
  update(initial);

  return {
    update,
    destroy() {
      window.removeEventListener("mw:preview-animation", preview);
      reset();
    },
  };
}

export function visibilityExitMs(
  animations: V2Animation[] | undefined,
  trigger: "playback" | "paused",
): number {
  return Math.max(
    0,
    ...(animations ?? [])
      .filter((animation) => animation.trigger === trigger && animation.exitEffect !== "none")
      .map((animation) =>
        animation.exitDelayMs +
        animation.exitDurationMs +
        (isLetterEffect(animation.exitEffect) ? MAX_STAGGER_WINDOW_MS : 0),
      ),
  );
}
