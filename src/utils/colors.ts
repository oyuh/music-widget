// src/utils/colors.ts
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.replace('#', '').match(/^([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  const full = m[1].length === 3 ? m[1].split('').map(c => c + c).join('') : m[1];
  const num = parseInt(full, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) => n.toString(16).padStart(2, '0');
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

export async function extractDominantColor(imgUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      // crossOrigin is useful for remote images; blob/data URLs don't need it
      if (!/^blob:|^data:/i.test(imgUrl)) {
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
            // quantize to reduce unique colors
            const key = `${Math.round(r/16)*16},${Math.round(g/16)*16},${Math.round(b/16)*16}`;
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
      // If we already have a blob/data URL, use it directly; otherwise go via proxy
      if (/^blob:|^data:/i.test(imgUrl)) {
        img.src = imgUrl;
      } else {
        const proxied = `/api/proxy-image?url=${encodeURIComponent(imgUrl)}`;
        img.src = proxied;
      }
    } catch {
      resolve(null);
    }
  });
}
