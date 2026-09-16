import crypto from "crypto";

/**
 * Server-side image validation. The browser's `accept="image/*"` and the
 * `File.type` it reports are both just client-supplied hints — trivial to
 * fake with a renamed file or a crafted request. This sniffs the actual
 * file bytes (magic numbers) instead of trusting either.
 */

export class InvalidImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidImageError";
  }
}

const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_DIMENSION = 8000; // guards against absurd/zip-bomb-style dimensions

interface Signature {
  ext: string;
  mime: string;
  matches: (buf: Buffer) => boolean;
}

const SIGNATURES: Signature[] = [
  {
    ext: "png",
    mime: "image/png",
    matches: (b) =>
      b.length >= 8 &&
      b[0] === 0x89 &&
      b[1] === 0x50 &&
      b[2] === 0x4e &&
      b[3] === 0x47 &&
      b[4] === 0x0d &&
      b[5] === 0x0a &&
      b[6] === 0x1a &&
      b[7] === 0x0a,
  },
  {
    ext: "jpg",
    mime: "image/jpeg",
    matches: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    ext: "webp",
    mime: "image/webp",
    matches: (b) => b.length >= 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP",
  },
  {
    ext: "gif",
    mime: "image/gif",
    matches: (b) => b.length >= 6 && (b.toString("ascii", 0, 6) === "GIF87a" || b.toString("ascii", 0, 6) === "GIF89a"),
  },
];

export interface ValidatedImage {
  buffer: Buffer;
  ext: string;
  mime: string;
}

export async function validateImageFile(file: File, opts?: { maxBytes?: number }): Promise<ValidatedImage> {
  const maxBytes = opts?.maxBytes ?? MAX_BYTES;
  if (file.size <= 0) {
    throw new InvalidImageError("El archivo está vacío.");
  }
  if (file.size > maxBytes) {
    throw new InvalidImageError(`La imagen supera el tamaño máximo permitido (${Math.round(maxBytes / 1024 / 1024)}MB).`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const signature = SIGNATURES.find((s) => s.matches(buffer));
  if (!signature) {
    throw new InvalidImageError("Formato de imagen no soportado. Usa PNG, JPG, WEBP o GIF.");
  }

  // Best-effort dimension guard. PNG's header makes this trivial; JPEG/WEBP
  // would need a fuller parser (or a dependency like `sharp`) to do
  // precisely — left as a documented gap, mitigated by the byte-size cap.
  if (signature.ext === "png" && buffer.length >= 24) {
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    if (width === 0 || height === 0 || width > MAX_DIMENSION || height > MAX_DIMENSION) {
      throw new InvalidImageError("Las dimensiones de la imagen no son válidas.");
    }
  }

  return { buffer, ext: signature.ext, mime: signature.mime };
}

/** Filename derived only from a fixed prefix + randomness — never from user input (the client-supplied File.name is untrusted and was previously used verbatim, enabling manipulated local paths). */
export function randomImageFilename(prefix: string, ext: string): string {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(8).toString("hex")}.${ext}`;
}
