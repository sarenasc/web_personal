#!/usr/bin/env node
/**
 * One-time migration: pulls `messages` out of the combined
 * `content/site-data.json` blob (the old schema, used up through commit
 * fd03f9a) and moves them into their own encrypted store at
 * `content/messages.enc` (the new schema — see src/lib/messages.ts).
 *
 * This is a READ-then-WRITE against the real production Blob store, so it
 * is NOT run automatically by anything — a human runs it deliberately,
 * once, after reviewing what it's about to do.
 *
 * Usage:
 *   BLOB_READ_WRITE_TOKEN=... MESSAGES_ENCRYPTION_KEY=... \
 *     node scripts/migrate-messages.mjs           # dry run: reads, backs up, writes + verifies content/messages.enc
 *   BLOB_READ_WRITE_TOKEN=... MESSAGES_ENCRYPTION_KEY=... \
 *     node scripts/migrate-messages.mjs --finalize  # also strips `messages` out of content/site-data.json
 *
 * Safety properties:
 *   - Backs up the current content/site-data.json to
 *     content/backups/pre-migration-site-data-<timestamp>.json before
 *     touching anything.
 *   - Writes content/messages.enc, then reads it back and decrypts it to
 *     confirm every message round-trips byte-for-byte before reporting
 *     success.
 *   - Never deletes/modifies content/site-data.json unless --finalize is
 *     passed AND the verification above passed AND messages.enc didn't
 *     already have a different message count (guards against re-running
 *     this against a site-data.json that was already migrated, or after
 *     someone added new messages through the old code path in between).
 *   - --finalize's rewrite is itself conditional (ifMatch on the
 *     site-data.json ETag read at the start of the run), so it refuses to
 *     clobber a concurrent edit made while this script was running.
 */
import { head, get, put } from "@vercel/blob";
import crypto from "crypto";

const SITE_DATA_PATHNAME = "content/site-data.json";
const MESSAGES_PATHNAME = "content/messages.enc";
const finalize = process.argv.includes("--finalize");

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Falta la variable de entorno ${name}.`);
    process.exit(1);
  }
  return value;
}

function encryptJson(value, keyBase64) {
  const key = Buffer.from(keyBase64, "base64");
  if (key.length !== 32) throw new Error("MESSAGES_ENCRYPTION_KEY debe decodificar a 32 bytes.");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(value), "utf-8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return ["v1", iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(".");
}

function decryptJson(payload, keyBase64) {
  const [v, ivB64, tagB64, dataB64] = payload.split(".");
  if (v !== "v1") throw new Error("Formato de payload cifrado no reconocido.");
  const key = Buffer.from(keyBase64, "base64");
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(tagB64, "base64");
  const ciphertext = Buffer.from(dataB64, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(plaintext.toString("utf-8"));
}

async function readJsonBlob(pathname) {
  const meta = await head(pathname).catch((err) => {
    if (err?.constructor?.name === "BlobNotFoundError") return null;
    throw err;
  });
  if (!meta) return { data: null, etag: null };
  const freshUrl = new URL(meta.url);
  freshUrl.searchParams.set("_v", Date.now().toString());
  const result = await get(freshUrl.toString(), { access: "public" });
  if (!result) throw new Error(`head() encontró ${pathname} pero get() no — estado inconsistente, abortando.`);
  const text = await new Response(result.stream).text();
  return { data: JSON.parse(text), etag: meta.etag };
}

async function main() {
  const encryptionKey = requireEnv("MESSAGES_ENCRYPTION_KEY");
  requireEnv("BLOB_READ_WRITE_TOKEN");

  console.log(`Leyendo ${SITE_DATA_PATHNAME}...`);
  const { data: siteData, etag: siteDataEtag } = await readJsonBlob(SITE_DATA_PATHNAME);
  if (!siteData) {
    console.log("No existe content/site-data.json todavía — nada que migrar.");
    return;
  }

  const messages = Array.isArray(siteData.messages) ? siteData.messages : [];
  console.log(`Encontrados ${messages.length} mensaje(s) en el esquema antiguo.`);

  console.log("Respaldando content/site-data.json antes de tocar nada...");
  const backupPathname = `content/backups/pre-migration-site-data-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  await put(backupPathname, JSON.stringify(siteData, null, 2), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
  });
  console.log(`Respaldo escrito en ${backupPathname}.`);

  if (messages.length === 0) {
    console.log("No hay mensajes que migrar. (El respaldo de site-data.json ya quedó escrito de todas formas.)");
  } else {
    console.log(`Escribiendo ${MESSAGES_PATHNAME} (cifrado)...`);
    const { etag: existingMessagesEtag } = await readJsonBlob(MESSAGES_PATHNAME);
    if (existingMessagesEtag) {
      console.error(
        `${MESSAGES_PATHNAME} ya existe — esta migración parece haber corrido antes. Abortando para no mezclar datos; revisa manualmente si esto es esperado.`
      );
      process.exit(1);
    }

    const ciphertext = encryptJson(messages, encryptionKey);
    await put(MESSAGES_PATHNAME, JSON.stringify({ v: 1, ciphertext }, null, 2), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: false, // must not already exist — see check above
    });

    console.log("Verificando el round-trip (leer + descifrar) antes de continuar...");
    const { data: writtenEnvelope } = await readJsonBlob(MESSAGES_PATHNAME);
    const decrypted = decryptJson(writtenEnvelope.ciphertext, encryptionKey);
    const matches = JSON.stringify(decrypted) === JSON.stringify(messages);
    if (!matches) {
      console.error("¡La verificación falló! Lo escrito no coincide con lo leído. NO se modificará site-data.json.");
      process.exit(1);
    }
    console.log(`Verificado: los ${decrypted.length} mensajes se descifran exactamente igual a los originales.`);
  }

  if (!finalize) {
    console.log("\nListo (sin --finalize). content/site-data.json NO fue modificado todavía.");
    console.log("Revisa que la app (ya con este código desplegado) muestre los mensajes correctamente en /admin,");
    console.log("y solo entonces vuelve a correr este script con --finalize para limpiar el campo `messages`");
    console.log("del esquema antiguo.");
    return;
  }

  console.log("\n--finalize: quitando `messages` de content/site-data.json...");
  const { messages: _removed, ...siteDataWithoutMessages } = siteData;
  void _removed;
  await put(SITE_DATA_PATHNAME, JSON.stringify(siteDataWithoutMessages, null, 2), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    ifMatch: siteDataEtag, // refuse to clobber a concurrent edit made during this run
  });
  console.log("Listo. content/site-data.json ya no incluye `messages`.");
  console.log(
    "\nNota sobre caché: content/site-data.json se sirve desde un store Blob público; su URL pública puede\n" +
      "haber sido cacheada por un CDN/navegador con el campo `messages` todavía presente (aunque cifrado no\n" +
      "estaba, en el esquema viejo iban en texto plano). La app ya no lo lee ni lo muestra, pero si quieres\n" +
      "asegurarte de que esa copia vieja deje de ser servida en algún lado, considera invalidar/purgar\n" +
      `cualquier caché externo que apunte a esa URL. El respaldo pre-migración queda en ${backupPathname}\n` +
      "por si necesitas revertir."
  );
}

main().catch((err) => {
  console.error("Migración abortada por un error:", err);
  process.exit(1);
});
