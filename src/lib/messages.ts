import path from "path";
import { randomUUID } from "crypto";
import { readBlobJson, writeBlobJson, readLocalJson, writeLocalJson, hasBlobToken } from "./blobStore";
import { encryptJson, decryptJson } from "./crypto";
import { requireAdmin } from "./auth";

/**
 * Contact messages (name, email, phone, body) are kept in their own store,
 * separate from the public site content — two reasons:
 *
 * 1. Privacy: the site's Blob store must stay "public" access (photos are
 *    served straight from it — see README), which makes its pathnames
 *    effectively unauthenticated URLs once known, and this repo is public
 *    on GitHub, so the pathname is not a secret either. In production, the
 *    stored payload is AES-256-GCM encrypted (MESSAGES_ENCRYPTION_KEY) so a
 *    guessed/leaked URL only yields ciphertext. See crypto.ts.
 * 2. Blast radius: previously every contact submission rewrote the *entire*
 *    site content (profile, experience, education, skills) to append one
 *    message — unnecessary risk to unrelated data on every form spam hit.
 */

export type Message = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  body: string;
  createdAt: string;
};

const BLOB_PATHNAME = "content/messages.enc";
const LOCAL_PATH = path.join(process.cwd(), "data", "messages.json");

interface EncryptedEnvelope {
  v: 1;
  ciphertext: string;
}

function isEncryptedEnvelope(value: unknown): value is EncryptedEnvelope {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as EncryptedEnvelope).v === 1 &&
    typeof (value as EncryptedEnvelope).ciphertext === "string"
  );
}

function isMessage(value: unknown): value is Message {
  if (typeof value !== "object" || value === null) return false;
  const m = value as Record<string, unknown>;
  return (
    typeof m.id === "string" &&
    typeof m.firstName === "string" &&
    typeof m.lastName === "string" &&
    typeof m.email === "string" &&
    typeof m.phone === "string" &&
    typeof m.body === "string" &&
    typeof m.createdAt === "string"
  );
}

function isMessageArray(value: unknown): value is Message[] {
  return Array.isArray(value) && value.every(isMessage);
}

async function readMessages(): Promise<Message[]> {
  if (hasBlobToken()) {
    const { data: envelope } = await readBlobJson(BLOB_PATHNAME, isEncryptedEnvelope);
    if (envelope === null) return [];
    const decrypted = decryptJson(envelope.ciphertext);
    if (!isMessageArray(decrypted)) {
      throw new Error("La estructura de los mensajes descifrados no es válida.");
    }
    return decrypted;
  }
  return (await readLocalJson(LOCAL_PATH, isMessageArray)) ?? [];
}

async function writeMessages(mutate: (current: Message[]) => Message[]): Promise<Message[]> {
  if (hasBlobToken()) {
    let result: Message[] = [];
    await writeBlobJson<EncryptedEnvelope>(
      BLOB_PATHNAME,
      (envelope) => {
        const current = decryptJson(envelope.ciphertext);
        const currentMessages = isMessageArray(current) ? current : [];
        const next = mutate(currentMessages);
        result = next;
        return { v: 1, ciphertext: encryptJson(next) };
      },
      { seed: { v: 1, ciphertext: encryptJson([]) }, validate: isEncryptedEnvelope }
    );
    return result;
  }

  // Local dev fallback: no real network exposure, so plaintext on disk is
  // fine here (mirrors how photos/content are handled locally too).
  return writeLocalJson(LOCAL_PATH, mutate, { seed: [], validate: isMessageArray });
}

export interface NewMessageInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  body: string;
}

/** Public: no admin auth required (this is what the contact form calls). Validation happens in the caller (see src/lib/validate.ts) before this is invoked. */
export async function addMessage(input: NewMessageInput): Promise<void> {
  const message: Message = { id: randomUUID(), ...input, createdAt: new Date().toISOString() };
  await writeMessages((current) => [...current, message]);
}

/** Admin-only. Double-checks the session itself (defense in depth) even though callers are also expected to call requireAdmin() before reaching here. */
export async function getMessagesForAdmin(): Promise<Message[]> {
  await requireAdmin();
  return readMessages();
}

/** Admin-only. Deleting an id that no longer exists is a no-op, not an error (idempotent). */
export async function deleteMessage(id: string): Promise<void> {
  await requireAdmin();
  await writeMessages((current) => current.filter((m) => m.id !== id));
}
