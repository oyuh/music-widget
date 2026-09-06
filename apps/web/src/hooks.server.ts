import type { Handle } from "@sveltejs/kit";

export const handle: Handle = ({ event, resolve }) => resolve(event, {
  transformPageChunk: ({ html }) => event.url.pathname.startsWith("/wiki")
    ? html.replace(/<!-- editor-only -->[\s\S]*?<!-- \/editor-only -->/g, "")
      .replace("<title>Last.fm Now Playing Widget | Free Music Overlay for OBS & Twitch</title>", "")
    : html,
});
