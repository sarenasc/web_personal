import { promises as fs } from "fs";
import path from "path";
import { put, del } from "@vercel/blob";
import { createJsonStore, hasBlobToken } from "./blobStore";
import { validateImageFile, randomImageFilename } from "./images";
import defaultContent from "../../data/default-content.json";

export { currentVersion } from "./version";

// `version` is optional in the stored shape so existing data saved before
// this field existed still passes validation (see isSiteContent below) —
// it's defaulted to 1 the first time an item is read/edited, not required
// retroactively on data nobody has touched. It's used for the update forms'
// conflict check (see admin/actions.ts): a save is only applied if the
// version it was opened with still matches the current one.
export type Profile = {
  name: string;
  title: string;
  tagline: string;
  bioShort: string;
  bioLong: string;
  location: string;
  email: string;
  linkedinUrl: string;
  githubUrl: string;
  heroPhotoUrl: string;
  aboutPhotoUrl: string;
  /** Optional (not required, unlike heroPhotoUrl/aboutPhotoUrl) since it was added after those — existing saved profiles don't have it yet and must still validate. */
  logoUrl?: string;
  version?: number;
};

export type Experience = {
  id: string;
  company: string;
  role: string;
  startDate: string;
  endDate: string;
  description: string;
  logoUrl: string;
  version?: number;
};

export type Skill = {
  id: string;
  name: string;
  category: string;
};

export type Education = {
  id: string;
  institution: string;
  program: string;
  startDate: string;
  endDate: string;
  description: string;
  version?: number;
};

export type SiteContent = {
  profile: Profile;
  experience: Experience[];
  education: Education[];
  skills: Skill[];
};

/**
 * Thrown from inside an updateContent() mutate callback when the record
 * being edited has moved on since the form was opened (someone else saved
 * a change, or the record was deleted) — see admin/actions.ts. Thrown here
 * (before the blob write is attempted) so it propagates immediately without
 * the store's usual retry-on-ETag-conflict loop retrying a stale edit
 * against the new data.
 */
export class ConflictError extends Error {
  constructor(
    message: string,
    public currentValues?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ConflictError";
  }
}

function isString(v: unknown): v is string {
  return typeof v === "string";
}
function isOptionalNumber(v: unknown): boolean {
  return v === undefined || typeof v === "number";
}
function isOptionalString(v: unknown): boolean {
  return v === undefined || typeof v === "string";
}

function isProfile(v: unknown): v is Profile {
  if (typeof v !== "object" || v === null) return false;
  const p = v as Record<string, unknown>;
  return (
    isString(p.name) &&
    isString(p.title) &&
    isString(p.tagline) &&
    isString(p.bioShort) &&
    isString(p.bioLong) &&
    isString(p.location) &&
    isString(p.email) &&
    isString(p.linkedinUrl) &&
    isString(p.githubUrl) &&
    isString(p.heroPhotoUrl) &&
    isString(p.aboutPhotoUrl) &&
    isOptionalString(p.logoUrl) &&
    isOptionalNumber(p.version)
  );
}

function isExperience(v: unknown): v is Experience {
  if (typeof v !== "object" || v === null) return false;
  const e = v as Record<string, unknown>;
  return (
    isString(e.id) &&
    isString(e.company) &&
    isString(e.role) &&
    isString(e.startDate) &&
    isString(e.endDate) &&
    isString(e.description) &&
    isString(e.logoUrl) &&
    isOptionalNumber(e.version)
  );
}

function isEducation(v: unknown): v is Education {
  if (typeof v !== "object" || v === null) return false;
  const e = v as Record<string, unknown>;
  return (
    isString(e.id) &&
    isString(e.institution) &&
    isString(e.program) &&
    isString(e.startDate) &&
    isString(e.endDate) &&
    isString(e.description) &&
    isOptionalNumber(e.version)
  );
}

function isSkill(v: unknown): v is Skill {
  if (typeof v !== "object" || v === null) return false;
  const s = v as Record<string, unknown>;
  return isString(s.id) && isString(s.name) && isString(s.category);
}

export function isSiteContent(v: unknown): v is SiteContent {
  if (typeof v !== "object" || v === null) return false;
  const c = v as Record<string, unknown>;
  return (
    isProfile(c.profile) &&
    Array.isArray(c.experience) &&
    c.experience.every(isExperience) &&
    Array.isArray(c.education) &&
    c.education.every(isEducation) &&
    Array.isArray(c.skills) &&
    c.skills.every(isSkill)
  );
}

const store = createJsonStore<SiteContent>({
  blobPathname: "content/site-data.json",
  localPath: path.join(process.cwd(), "data", "content.json"),
  seed: defaultContent as SiteContent,
  validate: isSiteContent,
  backupPrefix: "content/backups/site-data",
  backupRetain: 20,
});

export async function getContent(): Promise<SiteContent> {
  const data = await store.read();
  return data ?? (defaultContent as SiteContent);
}

/**
 * Applies `mutate` (in place) to the current content and saves it.
 * Underneath, this reads with the store's current ETag and writes
 * conditionally, retrying against fresh data on conflict — see
 * blobStore.ts. A read that can't be trusted (network/permission/service
 * error, corrupt JSON, invalid shape) throws instead of silently writing
 * over real data with seed defaults.
 */
export async function updateContent(mutate: (content: SiteContent) => void): Promise<SiteContent> {
  return store.write((current) => {
    mutate(current);
    return current;
  });
}

export async function uploadPhoto(file: File, prefix: string): Promise<string> {
  const { buffer, ext } = await validateImageFile(file);
  const filename = randomImageFilename(prefix, ext);

  if (hasBlobToken()) {
    const blob = await put(`photos/${filename}`, buffer, { access: "public" });
    return blob.url;
  }

  if (process.env.VERCEL) {
    throw new Error(
      "Falta configurar Vercel Blob: agrega un Blob store en Storage → Create Database y vuelve a desplegar (BLOB_READ_WRITE_TOKEN se agrega solo)."
    );
  }

  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(uploadsDir, { recursive: true });
  await fs.writeFile(path.join(uploadsDir, filename), buffer);
  return `/uploads/${filename}`;
}

/**
 * Best-effort cleanup for a photo/logo that's no longer referenced by any
 * record — either because it was replaced (old URL) or because the upload
 * succeeded but the content save that was supposed to reference it failed
 * (orphan). Never throws: a cleanup failure shouldn't fail the request that
 * triggered it, it just leaves an unused file behind for later.
 */
export async function deleteUploadedFile(url: string): Promise<void> {
  if (!url) return;
  try {
    if (hasBlobToken()) {
      if (url.includes(".blob.vercel-storage.com/")) {
        await del(url);
      }
      return;
    }
    if (url.startsWith("/uploads/")) {
      const uploadsDir = path.join(process.cwd(), "public", "uploads");
      const filename = path.basename(url); // never trust the rest of the path
      const resolved = path.join(uploadsDir, filename);
      if (path.dirname(resolved) === uploadsDir) {
        await fs.unlink(resolved).catch(() => {});
      }
    }
  } catch {
    // Best-effort — orphaned files are a cleanup nicety, not a correctness issue.
  }
}
