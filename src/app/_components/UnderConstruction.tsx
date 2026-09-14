export function UnderConstruction({ name }: { name: string }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="text-sm uppercase tracking-widest text-neutral-400">
        Próximamente
      </p>
      <h1 className="mt-3 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
        {name}
      </h1>
      <p className="mt-2 max-w-sm text-neutral-500">
        Este sitio está en construcción. Vuelve pronto.
      </p>
    </main>
  );
}
