# Portafolio personal

Sitio de portafolio personal (Next.js + Tailwind) con un panel de administración
propio en `/admin` para editar el contenido (perfil, historia, experiencia,
skills y fotos) sin tocar código.

**Dominio en producción:** `sarenasc.vercel.app` (confirmado vía la API de
Vercel — el proyecto no tiene ni ha tenido nunca un dominio
`web-personal-pi-puce.vercel.app`; si viste un 404 en esa URL, era una URL
equivocada, no un problema de este proyecto).

## Desarrollo local

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) para el sitio público y
[http://localhost:3000/admin](http://localhost:3000/admin) para el panel de
administración.

### Variables de entorno

Copia `.env.example` a `.env.local` y completa:

- `ADMIN_PASSWORD_HASH`: hash bcrypt de la contraseña del panel. Generarlo con:
  ```bash
  node scripts/hash-password.mjs "tu-contraseña"
  ```
  El script imprime la línea lista para copiar (ya escapada). **Importante:**
  Next.js expande los `$` dentro de archivos `.env`, así que cada `$` del hash
  bcrypt debe ir escapado como `\$` (el hash empieza con algo como `$2b$10$...`).
- `SESSION_SECRET`: string aleatorio de **al menos 32 caracteres**
  (`openssl rand -base64 32`) — el código ahora rechaza secretos más cortos al
  arrancar, para no firmar sesiones con un secreto débil.
- `BLOB_READ_WRITE_TOKEN`: solo necesario en producción (ver abajo). En local
  puedes dejarla vacía — el contenido se guarda en `data/content.json`, los
  mensajes de contacto en `data/messages.json` (sin cifrar — nunca salen de tu
  máquina) y las fotos subidas en `public/uploads/` (todo ignorado por git).
- `MESSAGES_ENCRYPTION_KEY`: clave para cifrar los mensajes de contacto en
  reposo (`openssl rand -base64 32`). **Obligatoria en producción**
  (cualquier despliegue con `BLOB_READ_WRITE_TOKEN`); opcional en local. Si la
  pierdes o la rotas, los mensajes ya guardados quedan ilegibles para
  siempre — no hay forma de recuperarlos sin la clave original. Guárdala en
  un gestor de contraseñas, no solo en la variable de entorno de Vercel.
- `SITE_LIVE`: déjala vacía mientras construyes el sitio. La home le muestra
  "en construcción" a cualquier visitante que no haya iniciado sesión en
  `/admin` — tú, logueado, siempre ves el sitio real. Ponla en `true` cuando
  quieras que todos vean el sitio.

### Pruebas

```bash
npm run lint    # eslint
npx tsc --noEmit  # typecheck
npm run test    # vitest — unit tests (auth, cifrado, conflictos de escritura, límites de tasa, idempotencia, validación de imágenes)
npm run build   # build de producción
```

Los tests corren contra un `@vercel/blob` simulado en memoria (`vi.mock`) —
no tocan ninguna cuenta ni store real de Vercel.

## Cómo funciona el contenido y por qué está separado en dos partes

No hay base de datos tradicional: el contenido vive en JSON, pero en **dos
almacenes separados**, no uno:

- **Contenido del sitio** (perfil, experiencia, educación, skills) —
  `content/site-data.json` en Blob (público, porque las fotos que referencia
  se sirven directo desde ahí) o `data/content.json` en local.
- **Mensajes de contacto** (nombre, correo, teléfono, cuerpo) —
  `content/messages.enc` en Blob, **cifrado con AES-256-GCM**
  (`MESSAGES_ENCRYPTION_KEY`), o `data/messages.json` en local (sin cifrar).

**Por qué van separados y cifrados:** el store de Blob debe ser de acceso
Público (ver más abajo, es requisito para servir las fotos), lo cual hace que
su pathname sea efectivamente una URL sin autenticación una vez conocida — y
como este repositorio es público en GitHub, el pathname exacto
(`content/site-data.json`) no es un secreto tampoco. Antes de este cambio,
los mensajes de contacto (con nombres, correos y teléfonos reales) vivían
en texto plano dentro de ese mismo archivo público. Ahora van en un archivo
separado y cifrado, y solo se leen/borran después de pasar por
`requireAdmin()` (doble verificación: la ruta `/admin` ya está protegida por
`src/proxy.ts`, y además cada acción del panel vuelve a comprobar la sesión
por su cuenta).

**Limitación conocida y mejora futura real:** esto mitiga la exposición
(un pathname filtrado solo entrega texto cifrado), pero el store Blob en sí
sigue siendo de acceso público a nivel de transporte. La mejora completa
sería mover `content/messages.enc` a un **Blob store Privado** — pero un
store solo puede ser enteramente Público o enteramente Privado (no mixto), y
como las fotos necesitan ser públicas, esto requeriría crear un **segundo**
store Blob solo para mensajes (con su propio `BLOB_READ_WRITE_TOKEN`), algo
que no se pudo hacer en esta revisión porque crear/configurar stores de Blob
es una acción manual en el dashboard de Vercel (no hay API/herramienta
automatizada disponible para eso). Ver `scripts/migrate-messages.mjs` si en
algún momento se agrega ese segundo store y hay que migrar.

Las fotos subidas desde el panel siguen la lógica del contenido del sitio
(disco local en desarrollo, Vercel Blob en producción) — ver
`src/lib/images.ts` para la validación (formato real por firma de bytes,
tamaño máximo, nombre de archivo generado al azar, nunca el nombre que
manda el navegador).

### Lecturas confiables (por qué `head()` + URL con cache-busting, no `get()` a secas)

`get()` de `@vercel/blob` con `useCache: false` **no hace nada en un store
Público** — esa opción solo se aplica a stores Privados (confirmado leyendo
el código del SDK). Como este store es Público, todas las lecturas usan
`head()` (que siempre pega contra la API de control de Vercel, nunca el CDN)
para obtener el ETag real, y `get()` sobre una copia de la URL del blob con
un parámetro de caché roto a propósito, para evitar que el CDN sirva una
copia vieja. Ver `src/lib/blobStore.ts`.

### Qué pasa si una lectura falla (y por qué ya no se usan valores por defecto en ese caso)

Antes, cualquier error de lectura (red, permisos, JSON corrupto) hacía que la
app mostrara silenciosamente el contenido semilla de `data/default-content.json`
— lo cual, combinado con un guardado sin protección, podía **sobrescribir el
contenido real** con esos valores por defecto. Ahora:

- Los valores por defecto solo se usan cuando el archivo **confirmadamente no
  existe** (primera vez, antes de guardar nada).
- Cualquier otro fallo de lectura (red, permisos, servicio caído, JSON
  corrupto, estructura inválida) lanza `UnreliableReadError` — y un guardado
  nunca procede sobre una lectura no confiable; ver `src/lib/blobStore.ts`.
- En las páginas, eso se ve como una pantalla de error clara (`error.tsx` en
  `/` y `/admin`) con un botón para reintentar, en vez de contenido vacío o
  falso.

### Conflictos de edición entre pestañas (control de versión)

El perfil y cada experiencia laboral tienen un contador `version` interno.
Cada formulario de edición manda de vuelta la versión que tenía cuando se
abrió; si alguien más ya guardó un cambio sobre ese mismo registro, el
guardado se rechaza con un aviso claro ("se modificó en otra sesión") **sin
reintentar automáticamente** la edición vieja sobre los datos nuevos, y sin
perder lo que la persona alcanzó a escribir. Ver `updateExperienceAction` /
`updateProfileAction` en `src/app/admin/actions.ts` y `ConflictError` en
`src/lib/content.ts`.

### Límites de intento y protección contra spam

El login (`/admin/login`) y el formulario de contacto público tienen límite
de intentos por IP (`src/lib/ratelimit.ts`), guardado en el mismo almacén de
contenido (Blob en producción, un archivo local en desarrollo) — **no** en
memoria del proceso, porque en un entorno serverless cada invocación puede
correr en una instancia distinta y un contador en memoria no protege nada
ahí. Es una solución simple, sin costo ni cuenta nueva que crear; para tráfico
alto convendría un almacén dedicado como Upstash Redis (vía Vercel
Marketplace, tiene capa gratuita pero es un servicio nuevo que habría que dar
de alta) — no se hizo ese cambio sin decidirlo antes con el dueño del sitio.

El formulario de contacto además tiene un campo honeypot invisible y rechaza
envíos completados en menos de ~1.5s (ambos indicios típicos de un bot) —
en ambos casos responde como si el envío hubiera funcionado, sin dar pistas
de qué lo bloqueó.

### Duplicados (doble clic, reintento de red)

Cada formulario de "Agregar"/edición/el formulario de contacto manda una
clave de idempotencia generada en el navegador; el servidor recuerda las
claves ya usadas por unos minutos (`src/lib/idempotency.ts`) y absorbe un
reenvío exacto sin crear un segundo registro — una nueva entrada (tras
limpiar el formulario o recargar la página) sí genera una clave nueva.

## Deploy en Vercel

1. Importa este repositorio en Vercel.
2. En el proyecto, ve a **Storage → Create Database → Blob** para habilitar
   Vercel Blob. Esto agrega automáticamente la variable `BLOB_READ_WRITE_TOKEN`.
   **Importante:** elige acceso **Public** para el store (no Private) — este
   código guarda el contenido y las fotos con `access: "public"`, y un store
   privado rechaza esos guardados con el error "Cannot use public access on
   a private store". Si cambias de store (borras uno y creas otro), el
   `BLOB_READ_WRITE_TOKEN` anterior queda apuntando a un store que ya no
   existe — tienes que reconectar el store nuevo al proyecto para que la
   variable se actualice, y luego desplegar de nuevo (ver nota sobre
   Redeploy más abajo).
3. En **Settings → Environment Variables**, agrega `ADMIN_PASSWORD_HASH`,
   `SESSION_SECRET` y `MESSAGES_ENCRYPTION_KEY`. A diferencia de un archivo
   `.env` local, el dashboard de Vercel no expande los `$`, así que aquí el
   hash va tal cual (sin escapar).
4. Deploy. El sitio público queda en `/` y el panel en `/admin`. Mientras
   `SITE_LIVE` no esté en `true`, solo tú (logueado en `/admin`) ves el sitio
   real — el resto ve "en construcción".

Como el contenido inicial vive en Vercel Blob solo después del primer guardado
desde `/admin`, la primera visita a producción mostrará los valores de
`data/default-content.json` hasta que edites algo desde el panel.

**Si agregas o cambias una variable de entorno después del primer deploy:**
el botón **Redeploy** del dashboard no siempre recoge variables nuevas (a
veces reutiliza el snapshot del deployment original). Lo más confiable es
generar un deploy nuevo con un `git push` — cualquier commit, por mínimo que
sea — en vez de usar "Redeploy" sobre un deployment viejo.

### Migrar mensajes existentes al esquema nuevo

Si ya tenías mensajes de contacto guardados con el código anterior a esta
revisión (viven dentro de `content/site-data.json`, sin cifrar), hay que
moverlos a `content/messages.enc`. **Este paso no se ejecutó como parte de
esta revisión** — hazlo tú, deliberadamente, cuando quieras:

```bash
BLOB_READ_WRITE_TOKEN=... MESSAGES_ENCRYPTION_KEY=... node scripts/migrate-messages.mjs
```

Eso lee `content/site-data.json`, guarda un respaldo completo antes de tocar
nada, escribe `content/messages.enc` cifrado, y **verifica el round-trip**
(lee lo que acaba de escribir y lo descifra) antes de terminar. No borra
nada del archivo original todavía. Una vez que confirmes en `/admin` que los
mensajes migrados se ven bien, vuelve a correrlo con `--finalize` para que
quite el campo `messages` de `content/site-data.json` (con un respaldo ya
hecho y una escritura condicional sobre esa misma versión, para no pisar un
cambio concurrente). El script explica al final la consideración sobre
caché de esa URL pública. Ver el encabezado de
`scripts/migrate-messages.mjs` para los detalles completos.

### Respaldos y recuperación

Cada guardado exitoso del contenido del sitio deja además una copia en
`content/backups/site-data-<timestamp>.json` (se conservan las últimas 20;
las más viejas se borran automáticamente — ver `writeBlobBackup` en
`src/lib/blobStore.ts`). Es best-effort: si el respaldo falla, no bloquea el
guardado real. Los mensajes de contacto no tienen backups automáticos propios
todavía (son pocos y de bajo volumen); si se necesita retención/purga
explícita de mensajes más adelante, es un cambio pequeño y aislado en
`src/lib/messages.ts`.

**Para restaurar una versión anterior manualmente:** con el `BLOB_READ_WRITE_TOKEN`
correcto, usa `vercel blob get content/backups/site-data-<timestamp>.json`
para ver un respaldo, y `vercel blob put` (o el mismo mecanismo del script de
migración) para volver a escribirlo en `content/site-data.json`. No hay un
botón de "restaurar" en el panel — es un procedimiento manual, documentado
aquí a propósito de no montar infraestructura nueva para un caso de uso poco
frecuente.

## Estructura

- `src/app/page.tsx` + `src/app/ContactForm.tsx` — sitio público (Hero, Sobre
  mí, Experiencia, Skills, Contacto).
- `src/app/admin/` — panel de administración (login + dashboard + server
  actions + un componente cliente por sección para mostrar estados de
  guardando/éxito/error/conflicto).
- `src/lib/content.ts` — contenido del sitio (perfil/experiencia/educación/skills).
- `src/lib/messages.ts` + `src/lib/crypto.ts` — mensajes de contacto, cifrados y separados.
- `src/lib/blobStore.ts` — lectura/escritura con ETag, reintentos seguros y
  detección de lecturas no confiables (Blob o archivo local atómico).
- `src/lib/auth.ts` + `src/proxy.ts` — autenticación de admin (cookie
  firmada), protección de rutas `/admin/*`, y `requireAdmin()` para usar
  dentro de cada acción.
- `src/lib/ratelimit.ts`, `src/lib/idempotency.ts`, `src/lib/validate.ts`,
  `src/lib/images.ts` — límites de intento, deduplicación, validación de
  entradas e imágenes.
- `data/default-content.json` — contenido inicial/semilla.
- `scripts/migrate-messages.mjs` — migración única del esquema viejo de mensajes.
- `tests/` — pruebas unitarias (vitest), con `@vercel/blob` simulado en memoria.
