import { promises as fs } from "fs";
import path from "path";
import { put, get } from "@vercel/blob";
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

export type Education = {
  id: string;
  institution: string;
  program: string;
  startDate: string;
  endDate: string;
  description: string;
};

export type Message = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  body: string;
  createdAt: string;
};

export type SiteContent = {
  profile: Profile;
  experience: Experience[];
  education: Education[];
  skills: Skill[];
  messages: Message[];
};

function normalize(content: Partial<SiteContent>): SiteContent {
  const seed = defaultContent as SiteContent;
  return {
    profile: { ...seed.profile, ...content.profile },
    experience: content.experience ?? [],
    education: content.education ?? [],
    skills: content.skills ?? [],
    messages: content.messages ?? [],
  };
}

const BLOB_PATHNAME = "content/site-data.json";
const LOCAL_PATH = path.join(process.cwd(), "data", "content.json");

function hasBlobToken() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export async function getContent(): Promise<SiteContent> {
  if (hasBlobToken()) {
    try {
      const result = await get(BLOB_PATHNAME, { access: "public", useCache: false });
      if (result) {
        const text = await new Response(result.stream).text();
        return normalize(JSON.parse(text) as Partial<SiteContent>);
      }
    } catch {
      // No blob saved yet — fall through to defaults.
    }
    return normalize(defaultContent as Partial<SiteContent>);
  }

  try {
    const raw = await fs.readFile(LOCAL_PATH, "utf-8");
    return normalize(JSON.parse(raw) as Partial<SiteContent>);
  } catch {
    return normalize(defaultContent as Partial<SiteContent>);
  }
}

export async function saveContent(content: SiteContent): Promise<void> {
  if (hasBlobToken()) {
    await put(BLOB_PATHNAME, JSON.stringify(content, null, 2), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return;
  }

  if (process.env.VERCEL) {
    throw new Error(
      "Falta configurar Vercel Blob: agrega un Blob store en Storage → Create Database y vuelve a desplegar (BLOB_READ_WRITE_TOKEN se agrega solo)."
    );
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

  if (process.env.VERCEL) {
    throw new Error(
      "Falta configurar Vercel Blob: agrega un Blob store en Storage → Create Database y vuelve a desplegar (BLOB_READ_WRITE_TOKEN se agrega solo)."
    );
  }

  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(uploadsDir, { recursive: true });
  const filename = `${prefix}-${Date.now()}-${file.name}`.replace(/\s+/g, "-");
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(uploadsDir, filename), buffer);
  return `/uploads/${filename}`;
}
