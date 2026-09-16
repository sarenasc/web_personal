import { describe, it, expect, vi, beforeEach } from "vitest";

const backend = vi.hoisted(() => {
  const store = new Map<string, { body: string; etag: string }>();
  let etagCounter = 0;
  function streamOf(text: string) {
    return new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(text));
        controller.close();
      },
    });
  }
  class BlobNotFoundError extends Error {}
  class BlobPreconditionFailedError extends Error {}
  return {
    store,
    reset() {
      store.clear();
      etagCounter = 0;
    },
    BlobNotFoundError,
    BlobPreconditionFailedError,
    head: async (pathname: string) => {
      const entry = store.get(pathname);
      if (!entry) throw new BlobNotFoundError();
      return { url: `https://fake.example/${pathname}`, etag: entry.etag };
    },
    get: async (urlOrPathname: string) => {
      const pathname = urlOrPathname.replace(/^https:\/\/fake\.example\//, "").replace(/\?.*$/, "");
      const entry = store.get(pathname);
      if (!entry) return null;
      return { stream: streamOf(entry.body) };
    },
    put: async (pathname: string, body: string, opts: { ifMatch?: string; allowOverwrite?: boolean }) => {
      const existing = store.get(pathname);
      if (opts.ifMatch !== undefined && existing?.etag !== opts.ifMatch) throw new BlobPreconditionFailedError();
      if (opts.allowOverwrite === false && existing) throw new Error("already exists");
      etagCounter += 1;
      const etag = `etag-${etagCounter}`;
      store.set(pathname, { body, etag });
      return { url: `https://fake.example/${pathname}`, etag };
    },
    del: async () => {},
    list: async () => ({ blobs: [] }),
  };
});

vi.mock("@vercel/blob", () => backend);

beforeEach(() => {
  backend.reset();
  process.env.BLOB_READ_WRITE_TOKEN = "fake-token-for-tests";
});

describe("ratelimit (shared storage-backed, not per-process memory)", () => {
  it("allows attempts under the limit and blocks the one that exceeds it", async () => {
    const { checkRateLimit } = await import("@/lib/ratelimit");
    const opts = { windowMs: 60_000, max: 3 };
    expect((await checkRateLimit("k1", opts)).allowed).toBe(true);
    expect((await checkRateLimit("k1", opts)).allowed).toBe(true);
    expect((await checkRateLimit("k1", opts)).allowed).toBe(true);
    const fourth = await checkRateLimit("k1", opts);
    expect(fourth.allowed).toBe(false);
    expect(fourth.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("a rejected attempt doesn't extend the lockout further (repeated polling while blocked doesn't dig a deeper hole)", async () => {
    const { checkRateLimit } = await import("@/lib/ratelimit");
    const opts = { windowMs: 60_000, max: 1 };
    await checkRateLimit("k2", opts);
    const first = await checkRateLimit("k2", opts);
    const second = await checkRateLimit("k2", opts);
    expect(first.allowed).toBe(false);
    expect(second.allowed).toBe(false);
    // Both still report retryAfterSeconds relative to the same original hit, not a moved-forward window.
    expect(Math.abs((first.retryAfterSeconds ?? 0) - (second.retryAfterSeconds ?? 0))).toBeLessThanOrEqual(1);
  });

  it("different bucket keys (e.g. different hashed IPs) don't interfere with each other", async () => {
    const { checkRateLimit } = await import("@/lib/ratelimit");
    const opts = { windowMs: 60_000, max: 1 };
    await checkRateLimit("ip-a", opts);
    const ipA = await checkRateLimit("ip-a", opts);
    const ipB = await checkRateLimit("ip-b", opts);
    expect(ipA.allowed).toBe(false);
    expect(ipB.allowed).toBe(true);
  });

  it("hashIdentifier never returns the raw input (we must not persist raw IPs)", async () => {
    const { hashIdentifier } = await import("@/lib/ratelimit");
    const hash = hashIdentifier("203.0.113.42");
    expect(hash).not.toContain("203.0.113.42");
    expect(hash.length).toBeGreaterThan(0);
  });
});
