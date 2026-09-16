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
    seedRaw(pathname: string, body: string) {
      etagCounter += 1;
      store.set(pathname, { body, etag: `etag-${etagCounter}` });
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

describe("content: schema validation", () => {
  it("isSiteContent accepts data saved before `version` existed (backward compatible)", async () => {
    const { isSiteContent } = await import("@/lib/content");
    const legacy = {
      profile: {
        name: "A",
        title: "T",
        tagline: "",
        bioShort: "",
        bioLong: "",
        location: "",
        email: "",
        linkedinUrl: "",
        githubUrl: "",
        heroPhotoUrl: "",
        aboutPhotoUrl: "",
        // no version field
      },
      experience: [
        { id: "1", company: "C", role: "R", startDate: "", endDate: "", description: "", logoUrl: "" }, // no version
      ],
      education: [],
      skills: [],
    };
    expect(isSiteContent(legacy)).toBe(true);
  });

  it("isSiteContent rejects garbage/corrupt shapes", async () => {
    const { isSiteContent } = await import("@/lib/content");
    expect(isSiteContent(null)).toBe(false);
    expect(isSiteContent({})).toBe(false);
    expect(isSiteContent({ profile: {}, experience: "not-an-array", education: [], skills: [] })).toBe(false);
    expect(isSiteContent({ profile: { name: 123 }, experience: [], education: [], skills: [] })).toBe(false);
  });
});

describe("content: version-conflict flow (via updateContent)", () => {
  it("a mutate() that checks currentVersion and throws on mismatch aborts without writing, and getContent() still sees the real (unedited) value", async () => {
    const { updateContent, getContent, currentVersion, ConflictError } = await import("@/lib/content");

    await updateContent((content) => {
      content.experience.push({
        id: "exp-1",
        company: "Original Co",
        role: "Original Role",
        startDate: "2020",
        endDate: "",
        description: "",
        logoUrl: "",
        version: 1,
      });
    });

    // Simulate a stale form: it read version 1, but by the time it saves,
    // someone else has already bumped it to 2.
    await updateContent((content) => {
      const exp = content.experience.find((e) => e.id === "exp-1")!;
      exp.company = "Updated elsewhere";
      exp.version = currentVersion(exp.version) + 1;
    });

    const staleSubmittedVersion = 1;
    await expect(
      updateContent((content) => {
        const exp = content.experience.find((e) => e.id === "exp-1")!;
        if (currentVersion(exp.version) !== staleSubmittedVersion) {
          throw new ConflictError("stale edit");
        }
        exp.company = "Should never apply";
      })
    ).rejects.toBeInstanceOf(ConflictError);

    const current = await getContent();
    expect(current.experience[0].company).toBe("Updated elsewhere");
  });
});
