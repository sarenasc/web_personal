import { describe, it, expect } from "vitest";
import { validateImageFile, randomImageFilename, InvalidImageError } from "@/lib/images";

function pngBuffer(width: number, height: number): Buffer {
  const buf = Buffer.alloc(24);
  buf[0] = 0x89;
  buf[1] = 0x50;
  buf[2] = 0x4e;
  buf[3] = 0x47;
  buf[4] = 0x0d;
  buf[5] = 0x0a;
  buf[6] = 0x1a;
  buf[7] = 0x0a;
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
}

function jpegBuffer(): Buffer {
  return Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
}

function webpBuffer(): Buffer {
  const buf = Buffer.alloc(16);
  buf.write("RIFF", 0, "ascii");
  buf.write("WEBP", 8, "ascii");
  return buf;
}

function gifBuffer(): Buffer {
  return Buffer.from("GIF89a" + "\0".repeat(10), "ascii");
}

function fileFrom(buf: Buffer, name = "photo.png", type = "image/png"): File {
  return new File([new Uint8Array(buf)], name, { type });
}

describe("images (server-side validation, never trusting the client's claimed type)", () => {
  it("accepts a real PNG and reports its sniffed dimensions/type", async () => {
    const result = await validateImageFile(fileFrom(pngBuffer(10, 20)));
    expect(result.ext).toBe("png");
    expect(result.mime).toBe("image/png");
  });

  it("accepts real JPEG/WEBP/GIF signatures", async () => {
    expect((await validateImageFile(fileFrom(jpegBuffer()))).ext).toBe("jpg");
    expect((await validateImageFile(fileFrom(webpBuffer()))).ext).toBe("webp");
    expect((await validateImageFile(fileFrom(gifBuffer()))).ext).toBe("gif");
  });

  it("rejects a file whose bytes aren't a real image, regardless of its claimed name/type", async () => {
    const fakeFile = fileFrom(Buffer.from("this is definitely not an image"), "totally-a-photo.png", "image/png");
    await expect(validateImageFile(fakeFile)).rejects.toThrow(InvalidImageError);
  });

  it("rejects an empty file", async () => {
    await expect(validateImageFile(fileFrom(Buffer.alloc(0)))).rejects.toThrow(InvalidImageError);
  });

  it("rejects a file over the size cap", async () => {
    const big = Buffer.concat([pngBuffer(1, 1), Buffer.alloc(6 * 1024 * 1024)]);
    await expect(validateImageFile(fileFrom(big))).rejects.toThrow(InvalidImageError);
  });

  it("rejects absurd PNG dimensions", async () => {
    await expect(validateImageFile(fileFrom(pngBuffer(50000, 50000)))).rejects.toThrow(InvalidImageError);
    await expect(validateImageFile(fileFrom(pngBuffer(0, 0)))).rejects.toThrow(InvalidImageError);
  });

  it("generates filenames independent of the original name (no path traversal via a crafted name)", () => {
    const a = randomImageFilename("hero", "png");
    const b = randomImageFilename("hero", "png");
    expect(a).not.toBe(b); // random component differs
    expect(a).not.toContain("..");
    expect(a).not.toContain("/");
    expect(a.endsWith(".png")).toBe(true);
  });
});
