import path from "node:path";
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

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  define: {
    __APP_COMMIT__: JSON.stringify(commitSha()),
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
