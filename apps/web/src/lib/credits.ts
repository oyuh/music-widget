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
  /** "If there was some sort of placeholder icon when no album art is available" */
  fallbackArt: { name: "leo" },
  /** "adding the feature to outline the fonts ... the text kinda not legible at all" */
  outline: { name: "Brian" },
  /** "I wish I could have more than one of an element" */
  instances: { name: "DISTORTICON" },
  /** "I would like the album accent color to have a consistent brightness" */
  accentBrightness: { name: "ytmn6" },
} satisfies Record<string, Credit>;
