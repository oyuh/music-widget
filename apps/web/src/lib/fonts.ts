import { getUsedFonts, type WidgetConfig } from "./config";

/** Build the Google Fonts CSS URL for a set of font families. */
export function googleFontsHrefFor(families: string[]): string {
  const query = families
    .filter(Boolean)
    .map((font) => `family=${encodeURIComponent(font).replace(/%20/g, "+")}`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${query}&display=swap`;
}

/** Build the Google Fonts CSS URL for every font used by the config. */
export function googleFontsHref(config: WidgetConfig): string {
  return googleFontsHrefFor(getUsedFonts(config));
}

/**
 * Ensure a <link> for the config's Google Fonts exists in <head>, updating the
 * single managed link when the font set changes. Client-only.
 */
export function ensureGoogleFonts(config: WidgetConfig) {
  if (typeof document === "undefined") return;

  const ensurePreconnect = (href: string, crossorigin = false) => {
    const sel = `link[rel="preconnect"][href="${href}"]`;
    if (document.head.querySelector(sel)) return;
    const link = document.createElement("link");
    link.rel = "preconnect";
    link.href = href;
    if (crossorigin) link.crossOrigin = "anonymous";
    document.head.appendChild(link);
  };

  ensurePreconnect("https://fonts.googleapis.com");
  ensurePreconnect("https://fonts.gstatic.com", true);

  const id = "mw-google-fonts";
  let link = document.getElementById(id) as HTMLLinkElement | null;
  const href = googleFontsHref(config);
  if (!link) {
    link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }
  if (link.href !== href) link.href = href;
}
