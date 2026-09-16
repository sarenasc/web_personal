"use client";

import type { ActionState } from "@/lib/actionState";

/** Success/error/conflict banner shown under a form. `role="status"`/`alert` + `aria-live` so screen readers announce the outcome without moving focus. */
export function FormBanner({ state }: { state: ActionState }) {
  if (!state || state.status === "idle") return null;

  if (state.status === "success") {
    return (
      <p role="status" aria-live="polite" className="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
        {state.message}
      </p>
    );
  }

  if (state.status === "conflict") {
    return (
      <p role="alert" aria-live="assertive" className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        {state.message}
      </p>
    );
  }

  return (
    <p role="alert" aria-live="assertive" className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
      {state.message}
    </p>
  );
}

export function fieldError(state: ActionState, field: string): string | undefined {
  return state?.fieldErrors?.[field];
}
