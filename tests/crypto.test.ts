import { describe, it, expect, beforeEach, afterEach } from "vitest";
import crypto from "crypto";
import { encryptJson, decryptJson, DecryptionError } from "@/lib/crypto";

const ORIGINAL_KEY = process.env.MESSAGES_ENCRYPTION_KEY;

function freshKey() {
  return crypto.randomBytes(32).toString("base64");
}

describe("crypto (message encryption at rest)", () => {
  beforeEach(() => {
    process.env.MESSAGES_ENCRYPTION_KEY = freshKey();
  });
  afterEach(() => {
    process.env.MESSAGES_ENCRYPTION_KEY = ORIGINAL_KEY;
  });

  it("round-trips arbitrary JSON", () => {
    const payload = [{ firstName: "Ana", email: "ana@example.com", body: "hola" }];
    const ciphertext = encryptJson(payload);
    expect(decryptJson(ciphertext)).toEqual(payload);
  });

  it("ciphertext never contains the plaintext PII", () => {
    const payload = [{ email: "very-unique-address@example.com" }];
    const ciphertext = encryptJson(payload);
    expect(ciphertext).not.toContain("very-unique-address@example.com");
  });

  it("fails to decrypt with a different key (wrong key never silently 'succeeds')", () => {
    const ciphertext = encryptJson({ secret: "value" });
    process.env.MESSAGES_ENCRYPTION_KEY = freshKey();
    expect(() => decryptJson(ciphertext)).toThrow(DecryptionError);
  });

  it("detects tampering (authenticated encryption)", () => {
    const ciphertext = encryptJson({ secret: "value" });
    const parts = ciphertext.split(".");
    // flip a character in the ciphertext portion
    const tamperedData = parts[3].slice(0, -1) + (parts[3].slice(-1) === "A" ? "B" : "A");
    const tampered = [parts[0], parts[1], parts[2], tamperedData].join(".");
    expect(() => decryptJson(tampered)).toThrow(DecryptionError);
  });

  it("throws when MESSAGES_ENCRYPTION_KEY is missing (fails closed, never stores plaintext by accident)", () => {
    delete process.env.MESSAGES_ENCRYPTION_KEY;
    expect(() => encryptJson({ a: 1 })).toThrow();
  });

  it("throws when the key is not 32 bytes", () => {
    process.env.MESSAGES_ENCRYPTION_KEY = Buffer.from("too-short").toString("base64");
    expect(() => encryptJson({ a: 1 })).toThrow();
  });
});
