// Mobile detection for gating the editor (which needs a real pointer + screen).
// The widget page (/w) is intentionally NOT gated so OBS/embeds keep working.

const MOBILE_UA_RE = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet|Silk/i;

/** Pure UA test (exported for unit testing). */
export function isMobileUA(ua: string): boolean {
  return MOBILE_UA_RE.test(ua);
}

/**
 * Whether the current device should get the desktop-only gate. UA-based, plus a
 * touch check for iPadOS — which reports a desktop Safari UA but is touch-only.
 */
export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (isMobileUA(ua)) return true;
  if (/Macintosh/.test(ua) && typeof document !== "undefined" && "ontouchend" in document) return true;
  return false;
}
