// Pure client-side SPA: no SSR, no prerendering. The Hono server serves the
// static index.html shell for every non-/api route and the client router
// handles /, /w and /callback.
export const ssr = false;
export const prerender = false;
export const csr = true;
export const trailingSlash = "ignore";
