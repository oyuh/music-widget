const sources = import.meta.glob<string>("../../../../../wiki/*.md", {
  query: "?raw", import: "default", eager: true,
});

// Every entry carries an `icon` key from $lib/ui/icons.ts and either markdown
// (articles) or keywords (the hand-written legal pages) for the search to match
// against.
const withHref = <T extends { slug: string }>(page: T) => ({ ...page, href: `/wiki${page.slug ? `/${page.slug}` : ""}` });

/** Pages rendered from the Markdown in /wiki, in reading order. */
export const articles = [
  { slug: "", file: "Home", icon: "book", title: "Jamlog wiki", label: "Overview", group: "Start here", description: "Set up the widget, learn each control, and fix common Last.fm and browser source problems." },
  { slug: "getting-started", file: "Getting-Started", icon: "power", title: "Get your widget on stream", label: "Getting started", group: "Start here", description: "Connect your music, choose a design, and add your widget to OBS, Streamlabs, or XSplit." },
  { slug: "playground", file: "Playground", icon: "play", title: "Widget playground", label: "Playground", group: "Build your widget", description: "Preview the built-in themes and test CSS against a sample widget." },
  { slug: "elements", file: "Elements", icon: "layout", title: "Arrange your elements", label: "Elements", group: "Build your widget", description: "Position and style the eight elements that make up your widget, from album art to the progress bar." },
  { slug: "animations", file: "Animations", icon: "sparkles", title: "Animate your widget", label: "Animations", group: "Build your widget", description: "Add playback, song-change, per-letter, image, and custom motion to any element." },
  { slug: "custom-css", file: "Custom-CSS", icon: "code", title: "Style with custom CSS", label: "Custom CSS", group: "Build your widget", description: "Target the widget's elements with CSS. Copy a recipe or open it in the playground to experiment." },
  { slug: "private-profiles", file: "Private-Profiles", icon: "eyeOff", title: "Connect a private profile", label: "Private profiles", group: "Help", description: "Authorize Last.fm to show your hidden listening, and learn how to keep your widget URL private." },
  { slug: "troubleshooting", file: "Troubleshooting", icon: "help", title: "Fix a widget problem", label: "Troubleshooting", group: "Help", description: "Check missing tracks, cropped text, album art, browser source settings, and custom CSS." },
].map((page) => withHref({
  ...page,
  keywords: "",
  markdown: sources[`../../../../../wiki/${page.file}.md`] ?? "",
}));

/** Legal pages. Same shell and sidebar as the rest, written in Svelte instead of Markdown. */
export const legalPages = [
  {
    slug: "privacy", icon: "shield", title: "Privacy", label: "Privacy", group: "Legal",
    description: "What the widget stores, what it never sees, and how to get rid of any of it.",
    keywords: "privacy data cookies local storage tracking fingerprint ip address usage counter feedback form email alerts google fonts album art removal gdpr delete",
  },
  {
    slug: "terms", icon: "document", title: "Terms", label: "Terms", group: "Legal",
    description: "Free, no account, provided as-is. What you can do with the widget and what isn't allowed.",
    keywords: "terms of service licence license rules allowed monetized sponsored self-host rate limits abuse trademarks uptime warranty experimental custom css stopping",
  },
].map((page) => withHref({
  ...page,
  markdown: "",
}));

/** Sidebar order, and the order the previous/next links walk. */
export const pages = [...articles, ...legalPages];

/** Sidebar groups, in the order they're listed. */
export const groups = ["Start here", "Build your widget", "Help", "Legal"];
