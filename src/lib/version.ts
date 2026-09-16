/**
 * Split out from content.ts so client components can import this tiny pure
 * helper without pulling in content.ts's Node-only dependencies (fs, the
 * Blob SDK) into the browser bundle.
 */
export function currentVersion(v: number | undefined): number {
  return typeof v === "number" ? v : 1;
}
