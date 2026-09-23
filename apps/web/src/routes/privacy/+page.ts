import { redirect } from "@sveltejs/kit";

// These pages moved into the wiki. Prerendered so the build emits a real
// redirect stub for anyone (or anything) still holding the old link.
export const ssr = true;
export const prerender = true;

export const load = () => redirect(308, "/wiki/privacy");
