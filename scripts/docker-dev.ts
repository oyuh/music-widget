import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";

const root = resolve(import.meta.dir, "..");
const composeFile = resolve(root, "docker-compose.dev.yml");
const dockerEnvFile = resolve(root, ".docker/local.env");

type EnvMap = Record<string, string>;

function parseEnvFile(path: string): EnvMap {
  if (!existsSync(path)) return {};
  const out: EnvMap = {};
  const lines = readFileSync(path, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }

  return out;
}

function pick(...values: Array<string | undefined>) {
  return values.find((value) => value && value.trim().length > 0) || "";
}

function writeDockerEnv() {
  const baseEnv = parseEnvFile(resolve(root, ".env"));
  const localEnv = parseEnvFile(resolve(root, ".env.local"));
  const workerEnv = parseEnvFile(resolve(root, "apps/api/.dev.vars"));

  const merged: EnvMap = {
    VITE_LFM_KEY: pick(process.env.VITE_LFM_KEY, localEnv.VITE_LFM_KEY, baseEnv.VITE_LFM_KEY, process.env.LFM_API_KEY, workerEnv.LFM_API_KEY, baseEnv.LFM_API_KEY),
    VITE_LFM_CALLBACK: pick(process.env.VITE_LFM_CALLBACK, localEnv.VITE_LFM_CALLBACK, baseEnv.VITE_LFM_CALLBACK, "http://localhost:8787/callback"),
    LFM_API_KEY: pick(process.env.LFM_API_KEY, workerEnv.LFM_API_KEY, localEnv.LFM_API_KEY, baseEnv.LFM_API_KEY, process.env.VITE_LFM_KEY, localEnv.VITE_LFM_KEY, baseEnv.VITE_LFM_KEY),
    LFM_SHARED_SECRET: pick(process.env.LFM_SHARED_SECRET, workerEnv.LFM_SHARED_SECRET, localEnv.LFM_SHARED_SECRET, baseEnv.LFM_SHARED_SECRET),
    REDIS_URL: "redis://redis:6379",
    LOG_LEVEL: pick(process.env.LOG_LEVEL, workerEnv.LOG_LEVEL, localEnv.LOG_LEVEL, baseEnv.LOG_LEVEL, "info"),
  };

  mkdirSync(resolve(root, ".docker"), { recursive: true });
  writeFileSync(
    dockerEnvFile,
    Object.entries(merged)
      .filter(([, value]) => value.length > 0)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n") + "\n",
  );

  if (!merged.LFM_API_KEY || !merged.LFM_SHARED_SECRET) {
    console.warn("Warning: missing LFM_API_KEY/LFM_SHARED_SECRET. The stack will boot, but Last.fm API routes will return a config error.");
  }
}

function ensureDocker() {
  const docker = spawnSync("docker", ["version"], { cwd: root, stdio: "ignore", shell: process.platform === "win32" });
  if (docker.status !== 0) {
    throw new Error("Docker is not available. Start Docker Desktop, then run this command again.");
  }

  const compose = spawnSync("docker", ["compose", "version"], { cwd: root, stdio: "ignore", shell: process.platform === "win32" });
  if (compose.status !== 0) {
    throw new Error("Docker Compose v2 is not available. Install/enable the Docker Compose plugin.");
  }
}

function runDocker(args: string[]) {
  return new Promise<number>((resolvePromise, reject) => {
    const child = spawn("docker", args, {
      cwd: root,
      stdio: "inherit",
      shell: process.platform === "win32",
    });

    child.on("exit", (code) => resolvePromise(code ?? 1));
    child.on("error", reject);
  });
}

function usage() {
  console.log(`Usage:
  bun run docker:dev              Build and start app + Redis
  bun run docker:dev -- --detach  Start in the background
  bun run docker:build            Build images without starting containers
  bun run docker:logs             Follow logs
  bun run docker:down             Stop and remove containers
  bun run docker:ps               Show compose services
`);
}

const [command = "up", ...rest] = process.argv.slice(2);
const detached = rest.includes("--detach") || rest.includes("-d");

if (command === "help" || command === "--help" || command === "-h") {
  usage();
  process.exit(0);
}

ensureDocker();

let composeArgs: string[];
switch (command) {
  case "up":
    writeDockerEnv();
    composeArgs = ["compose", "-f", composeFile, "up", "--build"];
    if (detached) composeArgs.push("-d");
    break;
  case "down":
    composeArgs = ["compose", "-f", composeFile, "down", "--remove-orphans"];
    break;
  case "logs":
    composeArgs = ["compose", "-f", composeFile, "logs", "-f"];
    break;
  case "ps":
    composeArgs = ["compose", "-f", composeFile, "ps"];
    break;
  case "build":
    writeDockerEnv();
    composeArgs = ["compose", "-f", composeFile, "build"];
    break;
  default:
    usage();
    throw new Error(`Unknown docker dev command: ${command}`);
}

const code = await runDocker(composeArgs);
process.exit(code);
