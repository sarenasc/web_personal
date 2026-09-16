import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";

// A tiny in-memory stand-in for the real Blob API, realistic enough to
// exercise messages.ts's actual read-modify-write path (including its
// encrypted envelope) rather than mocking each call in isolation.
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
      if (opts.ifMatch !== undefined && existing?.etag !== opts.ifMatch) {
        throw new BlobPreconditionFailedError();
      }
      if (opts.allowOverwrite === false && existing) {
        throw new Error("This blob already exists, use allowOverwrite: true.");
      }
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

const cookieStore = vi.hoisted(() => new Map<string, { value: string }>());
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => cookieStore.get(name),
    set: (name: string, value: string) => cookieStore.set(name, { value }),
    delete: (name: string) => cookieStore.delete(name),
  }),
}));

beforeEach(async () => {
  backend.reset();
  cookieStore.clear();
  process.env.BLOB_READ_WRITE_TOKEN = "fake-token-for-tests";
  process.env.MESSAGES_ENCRYPTION_KEY = crypto.randomBytes(32).toString("base64");
  process.env.SESSION_SECRET = "a-sufficiently-long-random-test-secret-value";
});

describe("messages: privacy + admin gating", () => {
  it("stores messages encrypted — the raw blob body never contains the submitted PII in plaintext", async () => {
    const { addMessage } = await import("@/lib/messages");
    await addMessage({
      firstName: "Ana",
      lastName: "Pérez",
      email: "ana.perez@example.com",
      phone: "+56911111111",
      body: "Hola, quisiera cotizar un proyecto.",
    });

    const raw = backend.store.get("content/messages.enc");
    expect(raw).toBeDefined();
    expect(raw!.body).not.toContain("ana.perez@example.com");
    expect(raw!.body).not.toContain("Ana");
    expect(raw!.body).not.toContain("+56911111111");
  });

  it("getMessagesForAdmin() rejects without a valid admin session", async () => {
    const { addMessage, getMessagesForAdmin } = await import("@/lib/messages");
    await addMessage({ firstName: "X", lastName: "Y", email: "x@example.com", phone: "", body: "hi" });
    await expect(getMessagesForAdmin()).rejects.toThrow();
  });

  it("getMessagesForAdmin() returns the decrypted messages once a valid admin session exists", async () => {
    const { addMessage, getMessagesForAdmin } = await import("@/lib/messages");
    const { createSessionToken, setSessionCookie } = await import("@/lib/auth");
    await setSessionCookie(await createSessionToken());

    await addMessage({ firstName: "Ana", lastName: "Pérez", email: "ana@example.com", phone: "", body: "Hola" });
    const messages = await getMessagesForAdmin();
    expect(messages).toHaveLength(1);
    expect(messages[0].firstName).toBe("Ana");
    expect(messages[0].email).toBe("ana@example.com");
  });

  it("deleteMessage() requires admin and is idempotent (deleting a missing id is a no-op, not an error)", async () => {
    const { deleteMessage } = await import("@/lib/messages");
    await expect(deleteMessage("no-such-id")).rejects.toThrow();

    const { createSessionToken, setSessionCookie } = await import("@/lib/auth");
    await setSessionCookie(await createSessionToken());
    await expect(deleteMessage("no-such-id")).resolves.toBeUndefined();
  });

  it("addMessage() never rewrites the site's public content blob (separate storage, per the review's blast-radius finding)", async () => {
    const { addMessage } = await import("@/lib/messages");
    await addMessage({ firstName: "A", lastName: "B", email: "a@b.com", phone: "", body: "hi" });
    expect(backend.store.has("content/site-data.json")).toBe(false);
    expect(backend.store.has("content/messages.enc")).toBe(true);
  });
});
