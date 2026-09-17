import { ImageResponse } from "next/og";
import { promises as fs } from "fs";
import path from "path";
import { getContent } from "@/lib/content";

export const dynamic = "force-dynamic";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

async function logoDataUri(logoUrl: string): Promise<string | null> {
  try {
    if (logoUrl.startsWith("http")) {
      const res = await fetch(logoUrl);
      if (!res.ok) return null;
      const buffer = Buffer.from(await res.arrayBuffer());
      const mime = res.headers.get("content-type") ?? "image/png";
      return `data:${mime};base64,${buffer.toString("base64")}`;
    }
    if (logoUrl.startsWith("/uploads/")) {
      // Local dev fallback storage — read straight off disk instead of
      // fetch()ing a relative URL, which has no base to resolve against here.
      const buffer = await fs.readFile(path.join(process.cwd(), "public", logoUrl));
      return `data:image/png;base64,${buffer.toString("base64")}`;
    }
  } catch {
    // fall through to the initials fallback below
  }
  return null;
}

export default async function Icon() {
  const { profile } = await getContent();

  const dataUri = profile.logoUrl ? await logoDataUri(profile.logoUrl) : null;
  if (dataUri) {
    return new ImageResponse(
      (
        // Rendered by Satori inside ImageResponse, not the DOM — an <img> is correct here, not next/image.
        <img src={dataUri} width={size.width} height={size.height} style={{ objectFit: "contain" }} alt="" />
      ),
      { ...size }
    );
  }

  const initials = profile.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 16,
          background: "#0b1220",
          color: "#22d3ee",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "monospace",
        }}
      >
        {initials}
      </div>
    ),
    { ...size }
  );
}
