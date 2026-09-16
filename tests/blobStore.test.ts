import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@vercel/blob", () => {
  class BlobNotFoundError extends Error {}
  class BlobPreconditionFailedError extends Error {}
  return {
    head: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    del: vi.fn(),
    list: vi.fn(),
    BlobNotFoundError,
    BlobPreconditionFailedError,
  };
});

import { head, get, put, BlobNotFoundError, BlobPreconditionFailedError } from "@vercel/blob";
import { readBlobJson, writeBlobJson, UnreliableReadError } from "@/lib/blobStore";

const headMock = head as unknown as ReturnType<typeof vi.fn>;
const getMock = get as unknown as ReturnType<typeof vi.fn>;
const putMock = put as unknown as ReturnType<typeof vi.fn>;

interface Doc {
  n: number;
}
const isDoc = (v: unknown): v is Doc => typeof v === "object" && v !== null && typeof (v as Doc).n === "number";

function streamOf(text: string) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
}

beforeEach(() => {
  headMock.mockReset();
  getMock.mockReset();
  putMock.mockReset();
});

describe("blobStore: readBlobJson", () => {
  it("returns {data: null, etag: null} for a confirmed-absent blob (not an error)", async () => {
    headMock.mockRejectedValueOnce(new BlobNotFoundError());
    const result = await readBlobJson("x.json", isDoc);
    expect(result).toEqual({ data: null, etag: null });
  });

  it("returns parsed data + etag when the blob exists and validates", async () => {
    headMock.mockResolvedValueOnce({ url: "https://x.example/blob", etag: "etag-1" });
    getMock.mockResolvedValueOnce({ stream: streamOf(JSON.stringify({ n: 42 })) });
    const result = await readBlobJson("x.json", isDoc);
    expect(result).toEqual({ data: { n: 42 }, etag: "etag-1" });
  });

  it("throws UnreliableReadError (never silently defaults) when head() fails for a reason other than not-found", async () => {
    headMock.mockRejectedValueOnce(new Error("network blip"));
    await expect(readBlobJson("x.json", isDoc)).rejects.toBeInstanceOf(UnreliableReadError);
  });

  it("throws UnreliableReadError when get() 404s despite head() confirming existence (inconsistent state)", async () => {
    headMock.mockResolvedValueOnce({ url: "https://x.example/blob", etag: "etag-1" });
    getMock.mockResolvedValueOnce(null);
    await expect(readBlobJson("x.json", isDoc)).rejects.toBeInstanceOf(UnreliableReadError);
  });

  it("throws UnreliableReadError on corrupt JSON", async () => {
    headMock.mockResolvedValueOnce({ url: "https://x.example/blob", etag: "etag-1" });
    getMock.mockResolvedValueOnce({ stream: streamOf("{not json") });
    await expect(readBlobJson("x.json", isDoc)).rejects.toBeInstanceOf(UnreliableReadError);
  });

  it("throws UnreliableReadError when the parsed shape fails validation", async () => {
    headMock.mockResolvedValueOnce({ url: "https://x.example/blob", etag: "etag-1" });
    getMock.mockResolvedValueOnce({ stream: streamOf(JSON.stringify({ wrong: "shape" })) });
    await expect(readBlobJson("x.json", isDoc)).rejects.toBeInstanceOf(UnreliableReadError);
  });
});

describe("blobStore: writeBlobJson", () => {
  it("first write (confirmed absent) uses allowOverwrite:false and no ifMatch", async () => {
    headMock.mockRejectedValueOnce(new BlobNotFoundError());
    putMock.mockResolvedValueOnce({});
    const result = await writeBlobJson<Doc>("x.json", (cur) => ({ n: cur.n + 1 }), { seed: { n: 0 }, validate: isDoc });
    expect(result).toEqual({ n: 1 });
    expect(putMock).toHaveBeenCalledTimes(1);
    const opts = putMock.mock.calls[0][2];
    expect(opts.allowOverwrite).toBe(false);
    expect(opts.ifMatch).toBeUndefined();
  });

  it("subsequent write uses allowOverwrite:true and ifMatch with the read etag", async () => {
    headMock.mockResolvedValueOnce({ url: "https://x.example/blob", etag: "etag-1" });
    getMock.mockResolvedValueOnce({ stream: streamOf(JSON.stringify({ n: 5 })) });
    putMock.mockResolvedValueOnce({});
    await writeBlobJson<Doc>("x.json", (cur) => ({ n: cur.n + 1 }), { seed: { n: 0 }, validate: isDoc });
    const opts = putMock.mock.calls[0][2];
    expect(opts.allowOverwrite).toBe(true);
    expect(opts.ifMatch).toBe("etag-1");
  });

  it("retries against fresh data on an ETag conflict instead of failing outright", async () => {
    // Attempt 1: reads etag-1, someone else wins the write race.
    headMock.mockResolvedValueOnce({ url: "https://x.example/blob", etag: "etag-1" });
    getMock.mockResolvedValueOnce({ stream: streamOf(JSON.stringify({ n: 5 })) });
    putMock.mockRejectedValueOnce(new BlobPreconditionFailedError());
    // Attempt 2: fresh read sees the winner's write, this time it succeeds.
    headMock.mockResolvedValueOnce({ url: "https://x.example/blob", etag: "etag-2" });
    getMock.mockResolvedValueOnce({ stream: streamOf(JSON.stringify({ n: 6 })) });
    putMock.mockResolvedValueOnce({});

    const result = await writeBlobJson<Doc>("x.json", (cur) => ({ n: cur.n + 1 }), { seed: { n: 0 }, validate: isDoc });
    expect(result).toEqual({ n: 7 }); // based on the SECOND read (6+1), not the stale first read
    expect(putMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after maxAttempts consecutive conflicts", async () => {
    for (let i = 0; i < 3; i++) {
      headMock.mockResolvedValueOnce({ url: "https://x.example/blob", etag: `etag-${i}` });
      getMock.mockResolvedValueOnce({ stream: streamOf(JSON.stringify({ n: i })) });
      putMock.mockRejectedValueOnce(new BlobPreconditionFailedError());
    }
    await expect(
      writeBlobJson<Doc>("x.json", (cur) => ({ n: cur.n + 1 }), { seed: { n: 0 }, validate: isDoc, maxAttempts: 3 })
    ).rejects.toBeInstanceOf(BlobPreconditionFailedError);
    expect(putMock).toHaveBeenCalledTimes(3);
  });

  it("a deliberate throw from mutate() (e.g. a version conflict) propagates immediately without ever calling put — no auto-retry over a stale edit", async () => {
    headMock.mockResolvedValueOnce({ url: "https://x.example/blob", etag: "etag-1" });
    getMock.mockResolvedValueOnce({ stream: streamOf(JSON.stringify({ n: 5 })) });

    class FakeConflict extends Error {}
    await expect(
      writeBlobJson<Doc>(
        "x.json",
        () => {
          throw new FakeConflict("stale edit");
        },
        { seed: { n: 0 }, validate: isDoc }
      )
    ).rejects.toBeInstanceOf(FakeConflict);
    expect(putMock).not.toHaveBeenCalled();
  });

  it("an unreliable read aborts the write entirely — never falls back to seed data as a base for a save", async () => {
    headMock.mockRejectedValueOnce(new Error("permission denied"));
    await expect(
      writeBlobJson<Doc>("x.json", (cur) => ({ n: cur.n + 1 }), { seed: { n: 0 }, validate: isDoc })
    ).rejects.toBeInstanceOf(UnreliableReadError);
    expect(putMock).not.toHaveBeenCalled();
  });
});
