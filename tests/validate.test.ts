import { describe, it, expect } from "vitest";
import {
  trimmedString,
  requireNonEmpty,
  requireMaxLength,
  requireEmail,
  requireUrlOrEmpty,
  isHoneypotTripped,
  isSubmittedTooFast,
} from "@/lib/validate";

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

describe("validate", () => {
  it("trims and caps length", () => {
    expect(trimmedString(fd({ x: "  hi  " }), "x")).toBe("hi");
    expect(trimmedString(fd({ x: "a".repeat(10) }), "x", 5)).toBe("aaaaa");
    expect(trimmedString(fd({}), "missing")).toBe("");
  });

  it("requireNonEmpty flags empty strings", () => {
    const errors: Record<string, string> = {};
    requireNonEmpty("", "name", errors, "Nombre");
    expect(errors.name).toMatch(/obligatorio/);
    const ok: Record<string, string> = {};
    requireNonEmpty("value", "name", ok, "Nombre");
    expect(ok.name).toBeUndefined();
  });

  it("requireMaxLength flags overly long values", () => {
    const errors: Record<string, string> = {};
    requireMaxLength("a".repeat(11), "bio", 10, errors, "Bio");
    expect(errors.bio).toBeDefined();
  });

  it("requireEmail rejects malformed addresses but allows empty (handled by requireNonEmpty separately)", () => {
    const bad: Record<string, string> = {};
    requireEmail("not-an-email", "email", bad);
    expect(bad.email).toBeDefined();

    const empty: Record<string, string> = {};
    requireEmail("", "email", empty);
    expect(empty.email).toBeUndefined();

    const good: Record<string, string> = {};
    requireEmail("a@b.com", "email", good);
    expect(good.email).toBeUndefined();
  });

  it("requireUrlOrEmpty rejects non-http(s) and malformed URLs, allows empty", () => {
    const empty: Record<string, string> = {};
    requireUrlOrEmpty("", "url", empty);
    expect(empty.url).toBeUndefined();

    const badScheme: Record<string, string> = {};
    requireUrlOrEmpty("javascript:alert(1)", "url", badScheme);
    expect(badScheme.url).toBeDefined();

    const malformed: Record<string, string> = {};
    requireUrlOrEmpty("not a url", "url", malformed);
    expect(malformed.url).toBeDefined();

    const good: Record<string, string> = {};
    requireUrlOrEmpty("https://example.com", "url", good);
    expect(good.url).toBeUndefined();
  });

  it("honeypot: tripped only when the hidden field is filled", () => {
    expect(isHoneypotTripped(fd({}))).toBe(false);
    expect(isHoneypotTripped(fd({ website: "" }))).toBe(false);
    expect(isHoneypotTripped(fd({ website: "http://spam.example" }))).toBe(true);
  });

  it("too-fast check: rejects submissions inside the minimum delay, allows slower ones, and doesn't block on a missing timestamp", () => {
    const now = Date.now();
    expect(isSubmittedTooFast(fd({ renderedAt: String(now) }), "renderedAt", 1500)).toBe(true);
    expect(isSubmittedTooFast(fd({ renderedAt: String(now - 2000) }), "renderedAt", 1500)).toBe(false);
    expect(isSubmittedTooFast(fd({}), "renderedAt", 1500)).toBe(false);
  });
});
