/** Server-side input validation. The browser's own validation (required, type=email) is a UX nicety, not a security boundary — every field is re-checked here. */

export class ValidationError extends Error {
  constructor(public fieldErrors: Record<string, string>) {
    super("validation_error");
    this.name = "ValidationError";
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function trimmedString(formData: FormData, field: string, maxLength = 2000): string {
  const raw = formData.get(field);
  const value = typeof raw === "string" ? raw.trim() : "";
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

export function requireNonEmpty(value: string, field: string, errors: Record<string, string>, label = field): void {
  if (!value) errors[field] = `${label} es obligatorio.`;
}

export function requireMaxLength(
  value: string,
  field: string,
  max: number,
  errors: Record<string, string>,
  label = field
): void {
  if (value.length > max) errors[field] = `${label} no puede superar ${max} caracteres.`;
}

export function requireEmail(value: string, field: string, errors: Record<string, string>): void {
  if (value && !EMAIL_RE.test(value)) errors[field] = "El correo no tiene un formato válido.";
}

export function requireUrlOrEmpty(value: string, field: string, errors: Record<string, string>): void {
  if (!value) return;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      errors[field] = "La URL debe empezar con http:// o https://.";
    }
  } catch {
    errors[field] = "La URL no es válida.";
  }
}

/**
 * A honeypot field: a form input hidden from real users with CSS (never
 * `display:none`/`type=hidden`, which some bots skip — an off-screen text
 * input is harder for naive bots to distinguish from a real field) that a
 * human never fills in. Any non-empty value here means the submission is
 * almost certainly automated.
 */
export function isHoneypotTripped(formData: FormData, field = "website"): boolean {
  const value = formData.get(field);
  return typeof value === "string" && value.trim().length > 0;
}

/** Rejects a submission that was filled in impossibly fast for a human (bots often submit within a few hundred ms of the page loading). */
export function isSubmittedTooFast(formData: FormData, field = "renderedAt", minMs = 1500): boolean {
  const raw = formData.get(field);
  const renderedAt = typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isFinite(renderedAt)) return false; // missing/invalid timestamp — don't block on it, just skip this check
  return Date.now() - renderedAt < minMs;
}
