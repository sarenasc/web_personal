import crypto from "crypto";
import path from "path";
import { createJsonStore } from "./blobStore";

/**
 * Shared, storage-backed rate limiter. Serverless functions don't share
 * memory between invocations/instances, so an in-process counter (a plain
 * `Map`, for example) resets constantly and doesn't actually limit anything
 * in production — this persists hit timestamps in the same storage as the
 * site content (Blob in prod, a local file in dev) so limits hold across
 * cold starts and concurrent instances.
 *
 * This is intentionally simple (no new paid service) for a low-traffic
 * personal site. For meaningfully higher traffic, a dedicated store like
 * Upstash Redis (Vercel Marketplace, has a free tier but is still a new
 * account/service to provision) would scale better and avoid the
 * read-modify-write contention this design has under heavy concurrent load
 * — worth it only if abuse actually shows up.
 */

interface Bucket {
  hits: number[];
}
type RateLimitState = Record<string, Bucket>;

function isBucket(v: unknown): v is Bucket {
  return (
    typeof v === "object" &&
    v !== null &&
    Array.isArray((v as Bucket).hits) &&
    (v as Bucket).hits.every((n) => typeof n === "number")
  );
}

function isRateLimitState(v: unknown): v is RateLimitState {
  return typeof v === "object" && v !== null && Object.values(v).every(isBucket);
}

const store = createJsonStore<RateLimitState>({
  blobPathname: "content/ratelimits.json",
  localPath: path.join(process.cwd(), "data", "ratelimits.json"),
  seed: {},
  validate: isRateLimitState,
});

/** Hashes an identifier (e.g. an IP) before it's ever persisted — we never store raw client IPs. */
export function hashIdentifier(id: string): string {
  return crypto.createHash("sha256").update(id).digest("hex").slice(0, 24);
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

const PRUNE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // drop buckets untouched for a day, keeps the store small

/**
 * Records an attempt for `bucketKey` and reports whether it's within
 * `max` attempts per `windowMs`. Rejected attempts are NOT counted again
 * against the limit (so a client can't be locked out forever by retrying
 * while already blocked).
 */
export async function checkRateLimit(
  bucketKey: string,
  opts: { windowMs: number; max: number }
): Promise<RateLimitResult> {
  const now = Date.now();
  const cutoff = now - opts.windowMs;
  let result: RateLimitResult = { allowed: true };

  await store.write((state) => {
    const next: RateLimitState = {};
    for (const [key, bucket] of Object.entries(state)) {
      const recent = bucket.hits.filter((t) => t > now - PRUNE_MAX_AGE_MS);
      if (recent.length > 0) next[key] = { hits: recent };
    }

    const bucket = next[bucketKey] ?? { hits: [] };
    const withinWindow = bucket.hits.filter((t) => t > cutoff);

    if (withinWindow.length >= opts.max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((withinWindow[0] + opts.windowMs - now) / 1000));
      result = { allowed: false, retryAfterSeconds };
      next[bucketKey] = { hits: withinWindow };
      return next;
    }

    withinWindow.push(now);
    next[bucketKey] = { hits: withinWindow };
    result = { allowed: true };
    return next;
  });

  return result;
}
