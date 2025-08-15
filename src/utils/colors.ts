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
  return L > 0.4 ? '#000000' : '#ffffff';
}

export async function extractDominantColor(imgUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const size = 32; // downscale for speed
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(null);
        try {
          ctx.drawImage(img, 0, 0, size, size);
          const { data } = ctx.getImageData(0, 0, size, size);
          const counts = new Map<string, number>();
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];
            if (a < 200) continue; // skip transparent
            // quantize to reduce unique colors
            const key = `${Math.round(r/16)*16},${Math.round(g/16)*16},${Math.round(b/16)*16}`;
            counts.set(key, (counts.get(key) ?? 0) + 1);
          }
          let max = 0;
          let best = '255,255,255';
          for (const [k, v] of counts) {
            if (v > max) { max = v; best = k; }
          }
          const [r, g, b] = best.split(',').map(Number);
          resolve(rgbToHex(r, g, b));
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = imgUrl;
    } catch {
      resolve(null);
    }
  });
}
