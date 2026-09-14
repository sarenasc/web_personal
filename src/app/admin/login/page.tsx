"use client";

import { useActionState } from "react";
import { loginAction } from "../actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, undefined);

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 dark:bg-neutral-950">
      <form
        action={formAction}
        className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
      >
        <h1 className="mb-6 text-xl font-semibold text-neutral-900 dark:text-neutral-100">
          Acceso administrador
        </h1>
        <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Contraseña
        </label>
        <input
          type="password"
          name="password"
          required
          autoFocus
          className="mb-4 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-800"
        />
        {state?.error && (
          <p className="mb-4 text-sm text-red-600 dark:text-red-400">{state.error}</p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {pending ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </main>
  );
}
