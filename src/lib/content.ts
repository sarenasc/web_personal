import { promises as fs } from "fs";
import path from "path";
import { put, head } from "@vercel/blob";
import defaultContent from "../../data/default-content.json";

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
};

export type Experience = {
  id: string;
  company: string;
  role: string;
  startDate: string;
  endDate: string;
  description: string;
  logoUrl: string;
};

export type Skill = {
  id: string;
  name: string;
  category: string;
};

export type SiteContent = {
  profile: Profile;
  experience: Experience[];
  skills: Skill[];
};

const BLOB_PATHNAME = "content/site-data.json";
const LOCAL_PATH = path.join(process.cwd(), "data", "content.json");

function hasBlobToken() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export async function getContent(): Promise<SiteContent> {
  if (hasBlobToken()) {
    try {
      const blob = await head(BLOB_PATHNAME);
      const res = await fetch(blob.url, { cache: "no-store" });
      if (res.ok) return (await res.json()) as SiteContent;
    } catch {
      // No blob saved yet — fall through to defaults.
    }
    return defaultContent as SiteContent;
  }

  try {
    const raw = await fs.readFile(LOCAL_PATH, "utf-8");
    return JSON.parse(raw) as SiteContent;
  } catch {
    return defaultContent as SiteContent;
  }
}

export async function saveContent(content: SiteContent): Promise<void> {
  if (hasBlobToken()) {
    await put(BLOB_PATHNAME, JSON.stringify(content, null, 2), {
      access: "public",
      contentType: "application/json",
      allowOverwrite: true,
    });
    return;
  }

  await fs.mkdir(path.dirname(LOCAL_PATH), { recursive: true });
  await fs.writeFile(LOCAL_PATH, JSON.stringify(content, null, 2), "utf-8");
}

export async function uploadPhoto(file: File, prefix: string): Promise<string> {
  if (hasBlobToken()) {
    const blob = await put(`photos/${prefix}-${Date.now()}-${file.name}`, file, {
      access: "public",
    });
    return blob.url;
  }

  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(uploadsDir, { recursive: true });
  const filename = `${prefix}-${Date.now()}-${file.name}`.replace(/\s+/g, "-");
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(uploadsDir, filename), buffer);
  return `/uploads/${filename}`;
}
