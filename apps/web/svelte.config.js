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
      precompress: false,
      strict: false,
    }),
    alias: {
      $lib: "src/lib",
    },
  },
};

export default config;
