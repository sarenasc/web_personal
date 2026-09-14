# Portafolio personal

Sitio de portafolio personal (Next.js + Tailwind) con un panel de administración
propio en `/admin` para editar el contenido (perfil, historia, experiencia,
skills y fotos) sin tocar código.

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
- `SESSION_SECRET`: cualquier string aleatorio largo (`openssl rand -base64 32`).
- `BLOB_READ_WRITE_TOKEN`: solo necesario en producción (ver abajo). En local
  puedes dejarla vacía — el contenido se guarda en `data/content.json` y las
  fotos subidas en `public/uploads/` (ambos ignorados por git).
- `SITE_LIVE`: déjala vacía mientras construyes el sitio. La home le muestra
  "en construcción" a cualquier visitante que no haya iniciado sesión en
  `/admin` — tú, logueado, siempre ves el sitio real. Ponla en `true` cuando
  quieras que todos vean el sitio.

## Cómo funciona el contenido

No hay base de datos: todo el contenido (perfil, experiencia, skills) vive en
un único JSON.

- En **local**, se lee/escribe en `data/content.json` (si no existe, se usa
  `data/default-content.json` como valores iniciales).
- En **producción (Vercel)**, se lee/escribe en [Vercel Blob](https://vercel.com/docs/storage/vercel-blob)
  usando `BLOB_READ_WRITE_TOKEN`.

Las fotos subidas desde el panel siguen la misma lógica (disco local en
desarrollo, Vercel Blob en producción).

## Deploy en Vercel

1. Importa este repositorio en Vercel.
2. En el proyecto, ve a **Storage → Create Database → Blob** para habilitar
   Vercel Blob. Esto agrega automáticamente la variable `BLOB_READ_WRITE_TOKEN`.
   **Importante:** elige acceso **Public** para el store (no Private) — este
   código guarda el contenido y las fotos con `access: "public"`, y un store
   privado rechaza esos guardados con el error "Cannot use public access on
   a private store".
3. En **Settings → Environment Variables**, agrega `ADMIN_PASSWORD_HASH` y
   `SESSION_SECRET`. A diferencia de un archivo `.env` local, el dashboard de
   Vercel no expande los `$`, así que aquí el hash va tal cual (sin escapar).
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

## Estructura

- `src/app/page.tsx` — sitio público (Hero, Sobre mí, Experiencia, Skills, Contacto).
- `src/app/admin/` — panel de administración (login + dashboard + server actions).
- `src/lib/content.ts` — capa de almacenamiento del contenido (JSON local o Blob).
- `src/lib/auth.ts` + `src/proxy.ts` — autenticación de admin (cookie firmada) y
  protección de rutas `/admin/*`.
- `data/default-content.json` — contenido inicial/semilla.
