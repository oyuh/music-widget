const sources = import.meta.glob<string>("../../../../../wiki/*.md", {
  query: "?raw", import: "default", eager: true,
});

export const pages = [
  { slug: "", file: "Home", title: "Jamlog wiki", label: "Overview", group: "Start here", description: "Set up the widget, learn each control, and fix common Last.fm and browser source problems." },
  { slug: "getting-started", file: "Getting-Started", title: "Get your widget on stream", label: "Getting started", group: "Start here", description: "Connect your music, choose a design, and add your widget to OBS, Streamlabs, or XSplit." },
  { slug: "playground", file: "Playground", title: "Widget playground", label: "Playground", group: "Build your widget", description: "Preview the built-in themes and test CSS against a sample widget." },
  { slug: "elements", file: "Elements", title: "Arrange your elements", label: "Elements", group: "Build your widget", description: "Position and style the eight elements that make up your widget, from album art to the progress bar." },
  { slug: "custom-css", file: "Custom-CSS", title: "Style with custom CSS", label: "Custom CSS", group: "Build your widget", description: "Target the widget's elements with CSS. Copy a recipe or open it in the playground to experiment." },
  { slug: "private-profiles", file: "Private-Profiles", title: "Connect a private profile", label: "Private profiles", group: "Help", description: "Authorize Last.fm to show your hidden listening, and learn how to keep your widget URL private." },
  { slug: "troubleshooting", file: "Troubleshooting", title: "Fix a widget problem", label: "Troubleshooting", group: "Help", description: "Check missing tracks, cropped text, album art, browser source settings, and custom CSS." },
].map((page) => ({ ...page, href: `/wiki${page.slug ? `/${page.slug}` : ""}`, markdown: sources[`../../../../../wiki/${page.file}.md`] ?? "" }));
