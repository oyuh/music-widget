import path from "node:path";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

function commitSha(): string {
  const fromEnv = process.env.VITE_COMMIT || process.env.RAILWAY_GIT_COMMIT_SHA;
  if (fromEnv) return fromEnv.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "dev";
  }
}

/**
 * The app's version number. The monorepo root package.json is the single source
 * of truth: bump it there (and tag the release) and every surface follows.
 * VITE_APP_VERSION can override it for one-off builds.
 */
function appVersion(): string {
  const fromEnv = process.env.VITE_APP_VERSION;
  if (fromEnv) return fromEnv.trim();
  try {
    const pkg = readFileSync(path.resolve(import.meta.dirname, "../../package.json"), "utf8");
    return (JSON.parse(pkg).version as string) || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  define: {
    __APP_COMMIT__: JSON.stringify(commitSha()),
    __APP_VERSION__: JSON.stringify(appVersion()),
  },
  // Read env from the monorepo root so .env / .env.local are the single source.
  envDir: path.resolve(import.meta.dirname, "../.."),
  server: {
    port: Number(process.env.PORT) || 5173,
    proxy: {
      "/api": "http://127.0.0.1:8787",
    },
  },
});
