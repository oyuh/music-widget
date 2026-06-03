import { test, expect, describe } from "bun:test";
import { isValidEmail } from "../apps/web/src/lib/usage";

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
