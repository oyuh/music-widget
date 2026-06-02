import { createHash } from "node:crypto";

export function md5(value: string) {
  return createHash("md5").update(value, "utf8").digest("hex");
}

export function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/** Build a Last.fm api_sig: sort params, concat key+value, append shared secret, md5. */
export function signLastfm(params: Record<string, string>, secret: string) {
  const sigBase =
    Object.keys(params)
      .sort()
      .map((key) => `${key}${params[key]}`)
      .join("") + secret;
  return md5(sigBase);
}

export function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      ...(init.headers || {}),
    },
  });
}

export function jsonText(body: string, status: number, headers: Record<string, string> = {}) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
}

export function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
