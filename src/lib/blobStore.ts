import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import {
  put,
  get,
  head,
  BlobNotFoundError,
  BlobPreconditionFailedError,
} from "@vercel/blob";

/**
 * Thrown when a read could not be trusted (network/permission/service error,
 * corrupt JSON, or a shape that fails validation). Distinct from "the blob
 * doesn't exist yet", which is a normal, expected state on first run.
 * Callers must NOT treat this the same as "no data" — falling back to seed
 * data here is what silently wiped real content in the past.
 */
export class UnreliableReadError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "UnreliableReadError";
  }
}

export function hasBlobToken(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/**
 * Reads a JSON blob with a fresh (non-CDN-cached) GET and returns its ETag.
 * - Confirmed absence (BlobNotFoundError from head()) resolves to `{ data: null, etag: null }`.
 * - Any other failure (network, auth, service, corrupt JSON, invalid shape)
 *   throws UnreliableReadError instead of silently returning null.
 */
export async function readBlobJson<T>(
  pathname: string,
  validate: (value: unknown) => value is T
): Promise<{ data: T | null; etag: string | null }> {
  let meta;
  try {
    meta = await head(pathname);
  } catch (err) {
    if (err instanceof BlobNotFoundError) {
      return { data: null, etag: null };
    }
    throw new UnreliableReadError(`No se pudo verificar el estado de ${pathname}.`, { cause: err });
  }

  // head() always hits Vercel's live control API (never the CDN); get()'s
  // useCache:false is a documented no-op for public stores, so we bypass the
  // CDN by fetching a cache-busted copy of the real blob URL instead.
  const freshUrl = new URL(meta.url);
  freshUrl.searchParams.set("_v", Date.now().toString());

  let result;
  try {
    result = await get(freshUrl.toString(), { access: "public" });
  } catch (err) {
    throw new UnreliableReadError(`No se pudo leer ${pathname}.`, { cause: err });
  }
  if (!result) {
    // head() confirmed it exists but the GET 404'd — an inconsistent state,
    // not a confirmed absence. Never treat this as "safe to use seed data".
    throw new UnreliableReadError(`Estado inconsistente al leer ${pathname}.`);
  }

  let parsed: unknown;
  try {
    const text = await new Response(result.stream).text();
    parsed = JSON.parse(text);
  } catch (err) {
    throw new UnreliableReadError(`Contenido corrupto en ${pathname}.`, { cause: err });
  }

  if (!validate(parsed)) {
    throw new UnreliableReadError(`La estructura de ${pathname} no es válida.`);
  }

  return { data: parsed, etag: meta.etag };
}

export interface WriteOptions<T> {
  seed: T;
  validate: (value: unknown) => value is T;
  maxAttempts?: number;
  /** Called (and awaited) with the value that was written, for best-effort backups. A failure here is swallowed — it never fails the primary write. */
  onWritten?: (value: T) => Promise<void> | void;
}

/**
 * Reads, mutates and writes a JSON blob with optimistic concurrency:
 * - When the blob doesn't exist yet, the write uses allowOverwrite:false so a
 *   concurrent "first write" from another request can't silently overwrite
 *   this one (or vice versa) — whichever loses the race retries against the
 *   real data instead.
 * - When it exists, the write is conditional on the ETag we just read
 *   (ifMatch), so a save based on stale data is rejected and retried against
 *   fresh data rather than silently clobbering someone else's change.
 * - A genuinely unreliable read (see UnreliableReadError) aborts the whole
 *   operation instead of writing on top of a guessed/default state.
 */
export async function writeBlobJson<T>(
  pathname: string,
  mutate: (current: T) => T,
  opts: WriteOptions<T>
): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 5;
  let lastErr: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { data, etag } = await readBlobJson(pathname, opts.validate);
    const current = data ?? opts.seed;
    const next = mutate(current);

    try {
      await put(pathname, JSON.stringify(next, null, 2), {
        access: "public",
        contentType: "application/json",
        addRandomSuffix: false,
        allowOverwrite: etag !== null,
        ifMatch: etag ?? undefined,
      });
      try {
        await opts.onWritten?.(next);
      } catch {
        // Backups/side-effects must never fail the primary write.
      }
      return next;
    } catch (err) {
      lastErr = err;
      // Either a genuine ETag conflict on an existing blob, or someone else
      // won the race to create it first (etag was null) — both mean "retry
      // against the now-current state", never "overwrite blindly".
      const isRace = err instanceof BlobPreconditionFailedError || etag === null;
      if (isRace && attempt < maxAttempts) continue;
      throw err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("No se pudo guardar tras varios intentos.");
}

export async function writeBlobBackup(backupPrefix: string, data: unknown, retain = 20): Promise<void> {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const pathname = `${backupPrefix}/${stamp}.json`;
  try {
    await put(pathname, JSON.stringify(data, null, 2), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
    });
  } catch {
    return; // best-effort — a failed backup must never block the real save
  }
  await pruneBackups(backupPrefix, retain).catch(() => {});
}

async function pruneBackups(backupPrefix: string, retain: number): Promise<void> {
  const { list, del } = await import("@vercel/blob");
  const { blobs } = await list({ prefix: `${backupPrefix}/` });
  const sorted = blobs.sort((a, b) => b.pathname.localeCompare(a.pathname));
  const toDelete = sorted.slice(retain).map((b) => b.pathname);
  if (toDelete.length > 0) await del(toDelete);
}

// ---------------------------------------------------------------------------
// Local (dev-only) JSON storage: same read/write contract, backed by a file
// on disk instead of Blob. Writes are atomic (temp file + rename) and
// serialized per-path so concurrent requests in the same process don't
// interleave writes or leave a torn file behind.
// ---------------------------------------------------------------------------

const localWriteQueues = new Map<string, Promise<unknown>>();

function queueLocalWrite<T>(key: string, task: () => Promise<T>): Promise<T> {
  const prior = localWriteQueues.get(key) ?? Promise.resolve();
  const next = prior.then(task, task);
  localWriteQueues.set(
    key,
    next.catch(() => {})
  );
  return next;
}

export async function readLocalJson<T>(
  filePath: string,
  validate: (value: unknown) => value is T
): Promise<T | null> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf-8");
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") {
      return null;
    }
    throw new UnreliableReadError(`No se pudo leer ${filePath}.`, { cause: err });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new UnreliableReadError(`Contenido corrupto en ${filePath}.`, { cause: err });
  }
  if (!validate(parsed)) {
    throw new UnreliableReadError(`La estructura de ${filePath} no es válida.`);
  }
  return parsed;
}

export interface JsonStore<T> {
  read(): Promise<T | null>;
  write(mutate: (current: T) => T): Promise<T>;
}

/**
 * Picks Blob storage (production) or an atomic local JSON file (dev,
 * when BLOB_READ_WRITE_TOKEN isn't set) transparently, with the same
 * unreliable-read guard and conflict-safe write contract either way.
 */
export function createJsonStore<T>(opts: {
  blobPathname: string;
  localPath: string;
  seed: T;
  validate: (value: unknown) => value is T;
  /** Blob pathname prefix (e.g. "content/backups/site-data") to write a timestamped backup under on every successful write. Blob-only; skipped in local dev. */
  backupPrefix?: string;
  backupRetain?: number;
}): JsonStore<T> {
  return {
    async read() {
      if (hasBlobToken()) {
        const { data } = await readBlobJson(opts.blobPathname, opts.validate);
        return data;
      }
      return readLocalJson(opts.localPath, opts.validate);
    },
    async write(mutate) {
      if (hasBlobToken()) {
        return writeBlobJson(opts.blobPathname, mutate, {
          seed: opts.seed,
          validate: opts.validate,
          onWritten: opts.backupPrefix
            ? (value) => writeBlobBackup(opts.backupPrefix as string, value, opts.backupRetain)
            : undefined,
        });
      }
      return writeLocalJson(opts.localPath, mutate, { seed: opts.seed, validate: opts.validate });
    },
  };
}

export async function writeLocalJson<T>(
  filePath: string,
  mutate: (current: T) => T,
  opts: { seed: T; validate: (value: unknown) => value is T }
): Promise<T> {
  return queueLocalWrite(filePath, async () => {
    const current = (await readLocalJson(filePath, opts.validate)) ?? opts.seed;
    const next = mutate(current);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const tmpPath = path.join(
      path.dirname(filePath),
      `.${path.basename(filePath)}.tmp-${crypto.randomBytes(6).toString("hex")}`
    );
    await fs.writeFile(tmpPath, JSON.stringify(next, null, 2), "utf-8");
    await fs.rename(tmpPath, filePath); // atomic on the same filesystem
    return next;
  });
}
