// src/utils/colors.ts
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.replace('#', '').match(/^([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  const full = m[1].length === 3 ? m[1].split('').map(c => c + c).join('') : m[1];
  const num = parseInt(full, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

export function rgbToHex(r: number, g: number, b: number): string {
  // Clamp to a valid 0-255 byte so we never emit a >2-digit channel (e.g. a
  // quantized 256 would render "100" and produce an invalid 7-digit hex that
  // browsers silently drop, making the styled element disappear).
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

export function getLuminance(r: number, g: number, b: number): number {
  // sRGB to linear
  const a = [r, g, b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}

export function getContrastText(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#ffffff';
  const L = getLuminance(rgb.r, rgb.g, rgb.b);
  // Choose the text color (black or white) that gives higher WCAG contrast
  const contrastWithWhite = (1.0 + 0.05) / (L + 0.05);
  const contrastWithBlack = (L + 0.05) / 0.05;
  return contrastWithBlack >= contrastWithWhite ? '#000000' : '#ffffff';
}

// Pick readable text (black/white) for a given background color
export function getReadableTextOn(bgHex: string): string {
  const rgb = hexToRgb(bgHex);
  if (!rgb) return '#ffffff';
  const L = getLuminance(rgb.r, rgb.g, rgb.b);
  const contrastWhite = (1.0 + 0.05) / (L + 0.05);
  const contrastBlack = (L + 0.05) / 0.05;
  return contrastBlack >= contrastWhite ? '#000000' : '#ffffff';
}

// Get the opposite/inverted color of a given color
export function getOppositeColor(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#000000';
  const oppositeR = 255 - rgb.r;
  const oppositeG = 255 - rgb.g;
  const oppositeB = 255 - rgb.b;
  return rgbToHex(oppositeR, oppositeG, oppositeB);
}

// Generate drop shadow CSS based on configuration
// `spread` grows the shadow outward (box-shadow's 4th length) so a shadow can hug
// an outlined silhouette instead of the bare shape underneath it. Omitted/0 keeps
// the original 3-length output, which is all text-shadow accepts anyway.
export function generateDropShadowCSS(
  config: {
    enabled: boolean;
    blur: number;
    intensity: number;
    offsetX: number;
    offsetY: number;
    useOppositeColor: boolean;
    customColor?: string;
  },
  baseColor: string,
  spread = 0
): string {
  if (!config.enabled) return '';

  const shadowColor = config.useOppositeColor
    ? getOppositeColor(baseColor)
    : (config.customColor || '#000000');

  const opacity = Math.max(0, Math.min(100, config.intensity)) / 100;
  const rgb = hexToRgb(shadowColor);

  if (!rgb) return '';

  const sp = spread ? ` ${spread}px` : '';
  return `${config.offsetX}px ${config.offsetY}px ${config.blur}px${sp} rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
}

// Generate per-element drop shadow CSS with individual settings
export function generateElementDropShadowCSS(
  globalConfig: {
    enabled: boolean;
    blur: number;
    intensity: number;
    offsetX: number;
    offsetY: number;
    useOppositeColor: boolean;
    customColor?: string;
  },
  elementConfig: {
    enabled?: boolean;
    blur?: number;
    intensity?: number;
    offsetX?: number;
    offsetY?: number;
    useOppositeColor?: boolean;
    customColor?: string;
  } | undefined,
  baseColor: string
): string {
  // Check global enabled state first
  if (!globalConfig.enabled) return '';

  // Check individual element enabled state - default to true if not specified
  const elementEnabled = elementConfig?.enabled ?? true;
  if (!elementEnabled) return '';

  // Merge global and element-specific settings
  const effectiveConfig = {
    enabled: true, // We already checked enabled states above
    blur: elementConfig?.blur ?? globalConfig.blur,
    intensity: elementConfig?.intensity ?? globalConfig.intensity,
    offsetX: elementConfig?.offsetX ?? globalConfig.offsetX,
    offsetY: elementConfig?.offsetY ?? globalConfig.offsetY,
    useOppositeColor: elementConfig?.useOppositeColor ?? globalConfig.useOppositeColor,
    customColor: elementConfig?.customColor ?? globalConfig.customColor,
  };

  return generateDropShadowCSS(effectiveConfig, baseColor);
}

function extractFrom(src: string, crossOrigin: boolean): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      if (crossOrigin) {
        img.crossOrigin = 'anonymous';
      }
      img.onload = () => {
        const size = 32; // downscale for speed
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(null);
        try {
          // Sample only the central region to avoid album borders/labels skewing the color
          const nw = img.naturalWidth || img.width;
          const nh = img.naturalHeight || img.height;
          const cropW = Math.max(1, Math.round(nw * 0.7));
          const cropH = Math.max(1, Math.round(nh * 0.7));
          const sx = Math.max(0, Math.round((nw - cropW) / 2));
          const sy = Math.max(0, Math.round((nh - cropH) / 2));
          ctx.drawImage(img, sx, sy, cropW, cropH, 0, 0, size, size);
          const { data } = ctx.getImageData(0, 0, size, size);
          const counts = new Map<string, number>();
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];
            if (a < 200) continue; // skip transparent
            // Ignore near-white and near-black pixels that often represent borders or backgrounds
            if ((r > 245 && g > 245 && b > 245) || (r < 10 && g < 10 && b < 10)) continue;
            // quantize to reduce unique colors (clamp so 248-255 doesn't round up to 256)
            const q = (v: number) => Math.min(255, Math.round(v / 16) * 16);
            const key = `${q(r)},${q(g)},${q(b)}`;
            counts.set(key, (counts.get(key) ?? 0) + 1);
          }
          let max = 0;
          let best = '255,255,255';
          for (const [k, v] of counts) {
            if (v > max) { max = v; best = k; }
          }
          if (counts.size === 0) {
            // Fallback: compute average color without filtering extremes
            let rSum = 0, gSum = 0, bSum = 0, n = 0;
            for (let i = 0; i < data.length; i += 4) {
              const a = data[i + 3];
              if (a < 200) continue;
              rSum += data[i];
              gSum += data[i + 1];
              bSum += data[i + 2];
              n++;
            }
            if (n > 0) {
              const r = Math.round(rSum / n);
              const g = Math.round(gSum / n);
              const b = Math.round(bSum / n);
              return resolve(rgbToHex(r, g, b));
            }
          }
          const [r, g, b] = best.split(',').map(Number);
          resolve(rgbToHex(r, g, b));
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = src;
    } catch {
      resolve(null);
    }
  });
}

export async function extractDominantColor(imgUrl: string): Promise<string | null> {
  if (/^blob:|^data:/i.test(imgUrl)) return extractFrom(imgUrl, false);
  // Album-art CDNs are CORS-enabled, so read directly from the user's browser
  // (no server load); fall back to our proxy only if the direct read fails.
  const direct = await extractFrom(imgUrl, true);
  if (direct) return direct;
  return extractFrom(`/api/proxy-image?url=${encodeURIComponent(imgUrl)}`, true);
}

// ---- perceptual brightness normalization ----
// Album art swings wildly in brightness: a dark cover yields a near-black accent
// that vanishes against a dark widget, a washed-out cover yields a near-white one.
// These helpers re-light an extracted color to a fixed PERCEIVED brightness while
// keeping its hue, so the accent stays recognizably "from the art" but the
// progress bar reads the same on every track.

export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h, s, l };
}

export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  if (s === 0) {
    const v = l * 255;
    return { r: v, g: v, b: v };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return { r: hue(h + 1 / 3) * 255, g: hue(h) * 255, b: hue(h - 1 / 3) * 255 };
}

/**
 * CIE L* (0-100) for a color: how bright it LOOKS, not how bright it is.
 * Raw luminance is a poor stand-in here (pure yellow and pure blue read as
 * wildly different "brightness" at the same HSL lightness); L* tracks the eye.
 */
export function perceivedLightness(hex: string): number | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const Y = getLuminance(rgb.r, rgb.g, rgb.b);
  return Y <= 0.008856 ? Y * 903.3 : 116 * Math.cbrt(Y) - 16;
}

/**
 * Re-light `hex` until it hits `targetL` perceived lightness (CIE L*, 0-100),
 * keeping its hue and as much saturation as the target allows. L* rises
 * monotonically with HSL lightness for a fixed hue/saturation, so a short binary
 * search lands within a fraction of a step. Colors we can't parse (and an
 * out-of-range target) come back untouched. An 8-digit hex keeps its alpha.
 */
export function normalizeLightness(hex: string, targetL: number): string {
  const raw = hex.trim();
  // Preserve a trailing alpha pair so accents carrying opacity survive the round trip.
  const m = raw.replace('#', '').match(/^([0-9a-f]{6})([0-9a-f]{2})$/i);
  const base = m ? `#${m[1]}` : raw;
  const alpha = m ? m[2] : '';

  const rgb = hexToRgb(base);
  if (!rgb) return hex;
  const target = Math.max(0, Math.min(100, targetL));
  const { h, s } = rgbToHsl(rgb.r, rgb.g, rgb.b);

  let lo = 0;
  let hi = 1;
  let mid = 0.5;
  for (let i = 0; i < 24; i++) {
    mid = (lo + hi) / 2;
    const c = hslToRgb(h, s, mid);
    const Y = getLuminance(c.r, c.g, c.b);
    const L = Y <= 0.008856 ? Y * 903.3 : 116 * Math.cbrt(Y) - 16;
    if (L < target) lo = mid;
    else hi = mid;
  }
  const out = hslToRgb(h, s, (lo + hi) / 2);
  return rgbToHex(out.r, out.g, out.b) + alpha;
}

/**
 * Apply the theme's "consistent brightness" setting to an accent color that came
 * FROM the album art. A hand-picked accent is deliberate and never re-lit, so
 * callers should only pass art-derived colors here.
 */
export function applyAccentBrightness(
  hex: string,
  theme: { accentNormalize?: boolean; accentBrightness?: number }
): string {
  if (!theme?.accentNormalize) return hex;
  return normalizeLightness(hex, theme.accentBrightness ?? 58);
}
