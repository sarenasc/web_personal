import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const cookieStore = new Map<string, { value: string }>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => cookieStore.get(name),
    set: (name: string, value: string) => cookieStore.set(name, { value }),
    delete: (name: string) => cookieStore.delete(name),
  }),
}));

const ORIGINAL_SECRET = process.env.SESSION_SECRET;

describe("auth", () => {
  beforeEach(() => {
    cookieStore.clear();
    process.env.SESSION_SECRET = "a-sufficiently-long-random-test-secret-value";
  });
  afterEach(() => {
    process.env.SESSION_SECRET = ORIGINAL_SECRET;
    vi.resetModules();
  });

  it("rejects a SESSION_SECRET shorter than 32 characters", async () => {
    process.env.SESSION_SECRET = "too-short";
    const { createSessionToken } = await import("@/lib/auth");
    await expect(createSessionToken()).rejects.toThrow(/corto/);
  });

  it("verifySessionToken: undefined/empty/garbage tokens are all rejected", async () => {
    const { verifySessionToken } = await import("@/lib/auth");
    expect(await verifySessionToken(undefined)).toBe(false);
    expect(await verifySessionToken("")).toBe(false);
    expect(await verifySessionToken("not-a-real-jwt")).toBe(false);
  });

  it("a session token created by createSessionToken verifies as admin", async () => {
    const { createSessionToken, verifySessionToken } = await import("@/lib/auth");
    const token = await createSessionToken();
    expect(await verifySessionToken(token)).toBe(true);
  });

  it("a token signed with a different secret is rejected (tamper/forgery resistance)", async () => {
    const { createSessionToken, verifySessionToken } = await import("@/lib/auth");
    const token = await createSessionToken();
    process.env.SESSION_SECRET = "a-completely-different-long-random-secret-value";
    expect(await verifySessionToken(token)).toBe(false);
  });

  it("requireAdmin() throws UnauthorizedError with no session cookie set", async () => {
    const { requireAdmin, UnauthorizedError } = await import("@/lib/auth");
    await expect(requireAdmin()).rejects.toThrow(UnauthorizedError);
  });

  it("requireAdmin() resolves once a valid session cookie is set", async () => {
    const { createSessionToken, setSessionCookie, requireAdmin } = await import("@/lib/auth");
    const token = await createSessionToken();
    await setSessionCookie(token);
    await expect(requireAdmin()).resolves.toBeUndefined();
  });

  it("clearSessionCookie() removes the cookie so requireAdmin() rejects again", async () => {
    const { createSessionToken, setSessionCookie, clearSessionCookie, requireAdmin } = await import("@/lib/auth");
    await setSessionCookie(await createSessionToken());
    await clearSessionCookie();
    await expect(requireAdmin()).rejects.toThrow();
  });
});
