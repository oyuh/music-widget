import { RedisClient } from "bun";
import { log } from "./log";

const REDIS_TIMEOUT_MS = 1500;

let client: RedisClient | null = null;
let initialized = false;

/**
 * Lazily create a single persistent Redis connection.
 *
 * Unlike the old Cloudflare Worker (which opened a raw socket per command),
 * the long-lived Bun server keeps one connection alive for the whole process.
 * Returns null when REDIS_URL is unset so the caller can fail open.
 */
function getClient(): RedisClient | null {
  if (initialized) return client;
  initialized = true;

  const url = process.env.REDIS_URL;
  if (!url) {
    client = null;
    return null;
  }

  client = new RedisClient(url, {
    // Cap how long we wait to establish the connection.
    connectionTimeout: REDIS_TIMEOUT_MS,
    // Surface failures fast instead of silently waiting on reconnect.
    autoReconnect: true,
    maxRetries: 2,
    enableOfflineQueue: false,
  });

  client.onclose = (error) => {
    log("warn", "redis.connection_closed", {
      error: error instanceof Error ? error.message : String(error),
    });
  };

  return client;
}

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${REDIS_TIMEOUT_MS}ms`)), REDIS_TIMEOUT_MS);
    }),
  ]).finally(() => clearTimeout(timer));
}

export function redisEnabled() {
  return Boolean(process.env.REDIS_URL);
}

export async function redisGet(key: string): Promise<string | null> {
  const c = getClient();
  if (!c) return null;
  const result = await withTimeout(c.send("GET", [key]), "Redis GET");
  if (result === null || result === undefined) return null;
  return typeof result === "string" ? result : String(result);
}

export async function redisSetEx(key: string, seconds: number, value: string): Promise<void> {
  const c = getClient();
  if (!c) return;
  await withTimeout(c.send("SET", [key, value, "EX", String(seconds)]), "Redis SET");
}

export async function redisPing(): Promise<boolean> {
  const c = getClient();
  if (!c) return false;
  const result = await withTimeout(c.send("PING", []), "Redis PING");
  return result === "PONG";
}
