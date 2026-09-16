"use client";

/**
 * Catches errors thrown while rendering the public page — in particular
 * UnreliableReadError from getContent() (see src/lib/blobStore.ts): a
 * genuine read failure (network/permission/service/corrupt data) now
 * surfaces here instead of silently rendering seed placeholder content as
 * if it were real.
 */
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-6 text-center">
      <p className="mb-2 font-mono text-xs tracking-wider text-cyan">
        <span className="text-muted">{"// "}</span>error
      </p>
      <h1 className="mb-3 text-lg font-semibold text-ink">No se pudo cargar el contenido</h1>
      <p className="mb-6 text-sm text-muted">
        Hubo un problema leyendo el contenido del sitio. Intenta de nuevo en un momento.
      </p>
      <button
        onClick={reset}
        className="border border-cyan px-5 py-2 font-mono text-sm text-cyan transition hover:bg-cyan hover:text-[#06202c]"
      >
        reintentar
      </button>
    </main>
  );
}
