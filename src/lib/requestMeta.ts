import { headers } from "next/headers";
import { hashIdentifier } from "./ratelimit";

/** Hashed client IP (never the raw address) for rate-limit bucketing. Vercel sets x-forwarded-for on every request; falls back to a constant bucket if it's ever missing (e.g. local dev), which just means local requests share one rate-limit bucket. */
export async function getClientIpHash(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : (h.get("x-real-ip") ?? "local");
  return hashIdentifier(ip || "unknown");
}
