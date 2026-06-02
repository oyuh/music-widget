import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";

const root = resolve(import.meta.dir, "..");
const devVarsPath = resolve(root, "apps/api/.dev.vars");

function env(name: string, fallback = "") {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value : fallback;
}

function quoteDevVar(value: string) {
  return JSON.stringify(value);
}

function run(command: string, args: string[], cwd = root) {
  return new Promise<void>((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
      shell: process.platform === "win32",
      env: process.env,
    });

    child.on("exit", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
    });
    child.on("error", reject);
  });
}

const lfmApiKey = env("LFM_API_KEY", env("VITE_LFM_KEY"));
const lfmSharedSecret = env("LFM_SHARED_SECRET");
const redisUrl = env("REDIS_URL", "redis://redis:6379");
const logLevel = env("LOG_LEVEL");

const devVars = [
  ["LFM_API_KEY", lfmApiKey],
  ["LFM_SHARED_SECRET", lfmSharedSecret],
  ["REDIS_URL", redisUrl],
  ["LOG_LEVEL", logLevel],
]
  .filter(([, value]) => value.length > 0)
  .map(([key, value]) => `${key}=${quoteDevVar(value)}`)
  .join("\n");

mkdirSync(dirname(devVarsPath), { recursive: true });
writeFileSync(devVarsPath, `${devVars}\n`);

console.log("Docker app container configured Worker dev vars.");
console.log(`Redis: ${redisUrl.replace(/:\/\/([^:]+):[^@]+@/, "://$1:***@")}`);
console.log(`Last.fm API key: ${lfmApiKey ? "present" : "missing"}`);
console.log(`Last.fm shared secret: ${lfmSharedSecret ? "present" : "missing"}`);

await run("bun", ["run", "build:web"]);
await run(
  "node",
  [
    "node_modules/wrangler/bin/wrangler.js",
    "dev",
    "--ip",
    "0.0.0.0",
    "--port",
    "8787",
    "--local",
    "--show-interactive-dev-session=false",
    "--persist-to",
    "/tmp/wrangler-state",
  ],
  resolve(root, "apps/api"),
);
