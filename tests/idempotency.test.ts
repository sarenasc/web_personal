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

describe("idempotency (distinguishes a resubmit from a new create)", () => {
  it("the first use of a key is new; the same key again within the TTL is not", async () => {
    const { claimIdempotencyKey } = await import("@/lib/idempotency");
    expect(await claimIdempotencyKey("key-1")).toBe(true);
    expect(await claimIdempotencyKey("key-1")).toBe(false);
    expect(await claimIdempotencyKey("key-1")).toBe(false); // a third repeat is still absorbed, not an error
  });

  it("a different key (a genuinely new submission, e.g. after the form reset) is treated as new", async () => {
    const { claimIdempotencyKey } = await import("@/lib/idempotency");
    expect(await claimIdempotencyKey("key-a")).toBe(true);
    expect(await claimIdempotencyKey("key-b")).toBe(true);
  });

  it("a key outside its TTL is treated as new again", async () => {
    const { claimIdempotencyKey } = await import("@/lib/idempotency");
    expect(await claimIdempotencyKey("key-ttl", 10)).toBe(true);
    await new Promise((r) => setTimeout(r, 30));
    expect(await claimIdempotencyKey("key-ttl", 10)).toBe(true);
  });
});
