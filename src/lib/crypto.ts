import crypto from "crypto";

/**
 * AES-256-GCM helpers for encrypting data at rest (contact messages).
 *
 * Why this exists: the site's Blob store must stay "public" access (photos
 * are served directly from it, and this SDK/account setup has no way to mix
 * private objects into a public store — see README). A public store's
 * pathnames are effectively unauthenticated URLs, and this pathname
 * (`content/messages.enc`) is disclosed in this public repository's source.
 * Encrypting the message payload means a leaked/guessed URL only yields
 * ciphertext, not names/emails/phone numbers/message bodies.
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // recommended for GCM

function getKey(): Buffer {
  const raw = process.env.MESSAGES_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "Falta configurar MESSAGES_ENCRYPTION_KEY: genera una con `openssl rand -base64 32` y agrégala como variable de entorno."
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      "MESSAGES_ENCRYPTION_KEY debe ser 32 bytes codificados en base64 (usa `openssl rand -base64 32`)."
    );
  }
  return key;
}

/** Encrypts a JSON-serializable value into a single opaque base64 string. */
export function encryptJson(value: unknown): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const plaintext = Buffer.from(JSON.stringify(value), "utf-8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // iv | authTag | ciphertext, all base64-joined with a version prefix.
  return ["v1", iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(".");
}

export class DecryptionError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "DecryptionError";
  }
}

/** Decrypts a payload produced by encryptJson(). Throws DecryptionError on tampering, wrong key, or corruption. */
export function decryptJson<T = unknown>(payload: string): T {
  const parts = payload.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new DecryptionError("Formato de payload cifrado no reconocido.");
  }
  const [, ivB64, tagB64, dataB64] = parts;
  const key = getKey();
  try {
    const iv = Buffer.from(ivB64, "base64");
    const authTag = Buffer.from(tagB64, "base64");
    const ciphertext = Buffer.from(dataB64, "base64");
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(plaintext.toString("utf-8")) as T;
  } catch (err) {
    throw new DecryptionError("No se pudo descifrar el contenido (clave incorrecta o datos corruptos).", {
      cause: err,
    });
  }
}
