/**
 * Who asked for what. Several settings in the editor exist because someone took
 * the time to write in through the "Give feedback" modal, so the tooltip for
 * each of those settings names them.
 *
 * Kept as data (rather than inlined into the hint strings) so a credit is one
 * line to add when the next suggestion ships, and so the "Suggested by" line is
 * styled the same everywhere instead of being re-typed into prose.
 */

/** Where a streaming handle lives, matching the feedback form's platform picker. */
export type Platform = "twitch" | "youtube" | "kick" | "other";

export type Credit = {
  /** Display name, exactly as they signed the feedback form. */
  name: string;
  /**
   * Their streaming handle, when they left one. Optional: most people submit a
   * name only, and those credits render as plain text.
   */
  handle?: string;
  /** Which platform the handle belongs to; picks the profile URL below. */
  platform?: Platform;
  /** The setting this became, as it's labelled in the editor. */
  setting?: string;
  /** What they asked for, in their own words from the feedback form. */
  asked?: string;
  /** What shipped, and where to find it. */
  shipped?: string;
};

/**
 * Handle -> profile URL. "other" has no known home to point at, so it (like a
 * missing handle) yields no link and the credit stays plain text.
 */
const PROFILE_URL: Partial<Record<Platform, (handle: string) => string>> = {
  twitch: (h) => `https://www.twitch.tv/${h}`,
  youtube: (h) => `https://www.youtube.com/@${h}`,
  kick: (h) => `https://kick.com/${h}`,
};

/** The link for a credit's handle, or null when there's nothing to link to. */
export function creditUrl(credit: Credit): string | null {
  const handle = credit.handle?.trim().replace(/^@/, "");
  if (!handle || !credit.platform) return null;
  return PROFILE_URL[credit.platform]?.(encodeURIComponent(handle)) ?? null;
}

/**
 * Features that came from user feedback, keyed by the setting they belong to.
 * Each one ships in a commit that lands days after the note that asked for it.
 */
export const CREDITS = {
  fallbackArt: {
    name: "leo",
    setting: "Fallback image",
    asked: "If there was some sort of placeholder icon when no album art is available",
    shipped:
      "Select the album art, then Album art › Fallback image. Paste a link to any image and it stands in whenever the real cover can't be fetched: a track with no artwork, a broken cover, or nothing playing yet. The link gets checked as you type, so a page URL pasted instead of an image URL gets caught right there.",
  },
  outline: {
    name: "Brian",
    setting: "Outline",
    asked: "adding the feature to outline the fonts ... the text kinda not legible at all",
    shipped:
      "Every element has an Outline section now: thickness, opacity and color, plus inside/center/outside placement on the shapes. Text outlines are drawn around the letters rather than over them, so words stay readable on a busy game background.",
  },
  instances: {
    name: "DISTORTICON",
    setting: "Multiple elements",
    asked: "I wish I could have more than one of an element",
    shipped:
      "The + beside each element in the left rail adds another one of that kind. Each copy carries its own position, size and styling, and Copy style in the inspector lifts the look from a sibling so a second title doesn't have to be restyled from scratch.",
  },
  accentBrightness: {
    name: "ytmn6",
    setting: "Consistent brightness",
    asked: "I would like the album accent color to have a consistent brightness",
    shipped:
      "Under Accent color, with Auto color from album art on. Album covers swing from near-black to near-white and the accent swung with them. This keeps the cover's hue but re-lights it to one fixed brightness, with a slider to set where that sits.",
  },
} satisfies Record<string, Credit>;
