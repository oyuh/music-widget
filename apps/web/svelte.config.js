import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    // Pure SPA: a single index.html shell that the Hono server serves for every
    // non-/api route, with client-side routing taking over.
    adapter: adapter({
      fallback: "index.html",
      // Emit .br/.gz next to each asset at build time; the Hono server picks
      // the smallest encoding the client accepts (see apps/server/src/index.ts).
      precompress: true,
      strict: false,
    }),
    alias: {
      $lib: "src/lib",
    },
  },
};

export default config;
