import { RedisClient } from "bun";
import { log } from "./log";

const REDIS_TIMEOUT_MS = 1500;
// After a failure, skip Redis entirely for this long so a sustained outage fails
// open instantly instead of paying the timeout on every request.
const CIRCUIT_COOLDOWN_MS = 3000;

let client: RedisClient | null = null;
let openUntil = 0;

function createClient(url: string): RedisClient {
  const c = new RedisClient(url, {
    connectionTimeout: REDIS_TIMEOUT_MS,
    autoReconnect: true,
    maxRetries: 1000,
    // Commands issued during a (re)connect wait for the socket rather than
    // failing instantly; withTimeout() below is the hard cap.
    enableOfflineQueue: true,
  });

  c.onclose = (error) => {
    log("warn", "redis.connection_closed", {
      error: error instanceof Error ? error.message : String(error),
    });
  };

  return c;
}

/**
 * Lazily build a single persistent connection. Unlike the old Worker (one socket
 * per command), the long-lived Bun server reuses one connection for the process.
 * Returns null when REDIS_URL is unset so callers can fail open.
 */
function getClient(): RedisClient | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  if (!client) client = createClient(url);
  return client;
}

/**
 * Drop a dead client so the next call rebuilds and reconnects from scratch.
 * Bun's client can otherwise get stuck in a terminal failed state after the
 * Redis server restarts (e.g. a Railway Redis redeploy).
 */
function dropClient() {
  const dead = client;
  client = null;
  if (dead) {
    try {
      dead.close();
    } catch {
      // already closed
    }
  }
}

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  // Guarantee the underlying promise always has a handler, so a rejection that
  // arrives after the timeout already won the race never becomes an unhandled
  // rejection (Bun surfaces those as bare 500s).
  promise.catch(() => {});

  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${REDIS_TIMEOUT_MS}ms`)), REDIS_TIMEOUT_MS);
    }),
  ]).finally(() => clearTimeout(timer));
}

async function exec<T>(label: string, run: (c: RedisClient) => Promise<T>): Promise<T> {
  if (Date.now() < openUntil) {
    throw new Error("Redis circuit open");
  }

  const c = getClient();
  if (!c) throw new Error("Redis disabled");

  try {
    const result = await withTimeout(run(c), label);
    openUntil = 0; // success closes the breaker
    return result;
  } catch (error) {
    // Trip the breaker and rebuild so the next attempt reconnects fresh.
    openUntil = Date.now() + CIRCUIT_COOLDOWN_MS;
    dropClient();
    throw error;
  }
}

export function redisEnabled() {
  return Boolean(process.env.REDIS_URL);
}

export async function redisGet(key: string): Promise<string | null> {
  if (!redisEnabled()) return null;
  const result = await exec("Redis GET", (c) => c.send("GET", [key]));
  if (result === null || result === undefined) return null;
  return typeof result === "string" ? result : String(result);
}

export async function redisSetEx(key: string, seconds: number, value: string): Promise<void> {
  if (!redisEnabled()) return;
  await exec("Redis SET", (c) => c.send("SET", [key, value, "EX", String(seconds)]));
}

export async function redisPing(): Promise<boolean> {
  if (!redisEnabled()) return false;
  const result = await exec("Redis PING", (c) => c.send("PING", []));
  return result === "PONG";
}

export async function redisIncr(key: string): Promise<number> {
  if (!redisEnabled()) return 0;
  const result = await exec("Redis INCR", (c) => c.send("INCR", [key]));
  return Number(result) || 0;
}

export async function redisExpire(key: string, seconds: number): Promise<void> {
  if (!redisEnabled()) return;
  await exec("Redis EXPIRE", (c) => c.send("EXPIRE", [key, String(seconds)]));
}
