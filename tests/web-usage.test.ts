import { test, expect, describe, beforeEach, afterAll, setSystemTime } from "bun:test";
import { isValidEmail, markFeedbackSent, feedbackRecentlySent } from "../apps/web/src/lib/usage";

describe("isValidEmail", () => {
  test("accepts normal addresses", () => {
    for (const e of ["a@b.co", "first.last@example.com", "  spaced@trim.io  "]) {
      expect(isValidEmail(e)).toBe(true);
    }
  });

  test("rejects junk", () => {
    for (const e of ["", "nope", "a@b", "a@@b.com", "a b@c.com", "@x.com", "x@.com"]) {
      expect(isValidEmail(e)).toBe(false);
    }
  });
});

// Minimal in-memory localStorage so the helpers run outside a browser.
function mockStorage() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

describe("feedback hide-for-a-week flag", () => {
  const DAY = 24 * 60 * 60 * 1000;
  const base = new Date("2026-06-04T00:00:00Z").getTime();
  let store: ReturnType<typeof mockStorage>;

  beforeEach(() => {
    store = mockStorage();
    (globalThis as { localStorage?: unknown }).localStorage = store;
    setSystemTime(new Date(base));
  });

  afterAll(() => {
    setSystemTime();
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });

  test("hidden right after sending, and still hidden 6 days later", () => {
    markFeedbackSent();
    expect(feedbackRecentlySent()).toBe(true);
    setSystemTime(new Date(base + 6 * DAY));
    expect(feedbackRecentlySent()).toBe(true);
  });

  test("reappears after 7 days, and the stale entry is cleared", () => {
    markFeedbackSent();
    setSystemTime(new Date(base + 8 * DAY));
    expect(feedbackRecentlySent()).toBe(false);
    expect(store.map.size).toBe(0); // self-healing: expired entry removed
  });

  test("no entry means visible", () => {
    expect(feedbackRecentlySent()).toBe(false);
  });

  test("a malformed value is treated as not-sent and cleared", () => {
    store.map.set("mw:feedbackSentAt", "not-a-number");
    expect(feedbackRecentlySent()).toBe(false);
    expect(store.map.size).toBe(0);
  });

  test("never throws when storage is unavailable", () => {
    delete (globalThis as { localStorage?: unknown }).localStorage;
    expect(() => markFeedbackSent()).not.toThrow();
    expect(feedbackRecentlySent()).toBe(false);
  });
});
