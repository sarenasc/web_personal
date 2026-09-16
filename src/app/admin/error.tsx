"use client";

/**
 * Catches errors thrown while rendering /admin — an UnreliableReadError from
 * getContent()/getMessagesForAdmin(), or requireAdmin() rejecting a stale/
 * invalid session. Showing this instead of an empty/default-looking form is
 * what stops an admin from re-entering data that's actually still saved
 * (the original "a veces no guarda" confusion) after a transient read
 * failure.
 */
export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // Next.js redacts the real error message/name for anything thrown in a
  // Server Component before it reaches this client boundary (only a
  // `digest` hash survives in production), so this can't reliably tell an
  // auth failure apart from a read failure — it covers both without
  // guessing which one happened.
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-4 text-center">
      <h1 className="mb-3 text-lg font-semibold text-neutral-900">No se pudo cargar el panel</h1>
      <p className="mb-6 text-sm text-neutral-600">
        Puede ser una sesión vencida o un problema leyendo el contenido guardado — en cualquier caso, no se perdió
        nada. Reintenta o vuelve a iniciar sesión.
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
        >
          Reintentar
        </button>
        <a
          href="/admin/login"
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Iniciar sesión
        </a>
      </div>
    </main>
  );
}
