import path from "path";
import { createJsonStore } from "./blobStore";

/**
 * Tracks idempotency keys for create-style operations (add experience/
 * education/skill, submit contact form). Each form renders with a fresh,
 * server-generated key in a hidden field; resubmitting the same rendered
 * form (double-click, browser retry, back-button resubmit) sends the same
 * key again and is recognized as a repeat rather than a new record. A page
 * reload/new page render gets a new key, so it's treated as a genuinely new
 * submission — that's the distinction between a retry and a legitimate
 * resend the review asked for.
 */

type IdempotencyState = Record<string, number>; // key -> first-seen timestamp (ms)

function isIdempotencyState(v: unknown): v is IdempotencyState {
  return (
    typeof v === "object" &&
    v !== null &&
    Object.values(v).every((n) => typeof n === "number")
  );
}

const store = createJsonStore<IdempotencyState>({
  blobPathname: "content/idempotency.json",
  localPath: path.join(process.cwd(), "data", "idempotency.json"),
  seed: {},
  validate: isIdempotencyState,
});

const DEFAULT_TTL_MS = 15 * 60 * 1000; // 15 minutes is plenty for a double-click or a page-reload retry

/**
 * Returns true the first time a key is seen (caller should proceed with the
 * mutation), false on any repeat within the TTL (caller should treat the
 * operation as already done and respond as if it succeeded, without
 * mutating again).
 */
export async function claimIdempotencyKey(key: string, ttlMs = DEFAULT_TTL_MS): Promise<boolean> {
  const now = Date.now();
  let isNew = true;

  await store.write((state) => {
    const next: IdempotencyState = {};
    for (const [k, seenAt] of Object.entries(state)) {
      if (now - seenAt < ttlMs) next[k] = seenAt;
    }
    if (Object.prototype.hasOwnProperty.call(next, key)) {
      isNew = false;
      return next;
    }
    next[key] = now;
    isNew = true;
    return next;
  });

  return isNew;
}
