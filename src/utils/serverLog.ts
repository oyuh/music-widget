import type { NextApiRequest } from "next";
import crypto from "crypto";

export type ServerLogLevel = "debug" | "info" | "warn" | "error";

type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

const LEVEL_WEIGHT: Record<ServerLogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function normalizeLevel(value: string | undefined): ServerLogLevel {
  const v = (value || "").toLowerCase();
  if (v === "debug" || v === "info" || v === "warn" || v === "error") return v;
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

const MIN_LEVEL = normalizeLevel(process.env.LOG_LEVEL);

export function getRequestId(req: Pick<NextApiRequest, "headers">): string {
  const h = req.headers || {};
  const fromHeader = (h["x-request-id"] as string) || (h["x-vercel-id"] as string) || (h["x-amzn-trace-id"] as string);
  if (fromHeader) return String(fromHeader);

  // Node 20+ supports crypto.randomUUID(). Keep a fallback just in case.
  return typeof crypto.randomUUID === "function" ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex");
}

export function safeUrlForLog(rawUrl: string): { host?: string; pathname?: string; protocol?: string } {
  try {
    const u = new URL(rawUrl);
    return { protocol: u.protocol, host: u.host, pathname: u.pathname };
  } catch {
    return {};
  }
}

export function serializeError(err: unknown): { name?: string; message: string; stack?: string } {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  try {
    return { message: JSON.stringify(err) };
  } catch {
    return { message: String(err) };
  }
}

function shouldLog(level: ServerLogLevel): boolean {
  return LEVEL_WEIGHT[level] >= LEVEL_WEIGHT[MIN_LEVEL];
}

function emit(level: ServerLogLevel, event: string, meta?: Record<string, JsonValue>) {
  if (!shouldLog(level)) return;

  const payload: Record<string, JsonValue> = {
    ts: new Date().toISOString(),
    level,
    event,
    ...(meta || {}),
  };

  const line = JSON.stringify(payload);

  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export function logDebug(event: string, meta?: Record<string, JsonValue>) {
  emit("debug", event, meta);
}

export function logInfo(event: string, meta?: Record<string, JsonValue>) {
  emit("info", event, meta);
}

export function logWarn(event: string, meta?: Record<string, JsonValue>) {
  emit("warn", event, meta);
}

export function logError(event: string, meta?: Record<string, JsonValue>) {
  emit("error", event, meta);
}
