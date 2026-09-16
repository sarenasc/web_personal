import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

const COOKIE_NAME = "admin_session";
const SESSION_DURATION = "8h";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;
const MIN_SECRET_LENGTH = 32;

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET no está configurado.");
  }
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `SESSION_SECRET es demasiado corto (mínimo ${MIN_SECRET_LENGTH} caracteres). Genera uno nuevo con \`openssl rand -base64 32\`.`
    );
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(): Promise<string> {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_DURATION)
    .sign(getSecret());
}

/** Verifies a raw token string. jose's jwtVerify already rejects expired (exp) and malformed/tampered tokens. */
export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload.role === "admin";
  } catch {
    return false;
  }
}

export class UnauthorizedError extends Error {
  constructor(message = "No autorizado. Vuelve a iniciar sesión.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/**
 * Centralized session check for use inside every Server Action that reads
 * private data, mutates content, deletes records, or uploads files. Route
 * protection in proxy.ts stays as a first layer (redirects unauthenticated
 * page loads to /admin/login), but Server Actions are POST targets in their
 * own right — this is the check that actually gates the mutation, so it
 * can't be bypassed by a request that skips the page render.
 */
export async function requireAdmin(): Promise<void> {
  const cookieStore = await cookies();
  const isValid = await verifySessionToken(cookieStore.get(COOKIE_NAME)?.value);
  if (!isValid) {
    throw new UnauthorizedError();
  }
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export { COOKIE_NAME };
