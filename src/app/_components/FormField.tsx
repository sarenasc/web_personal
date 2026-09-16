"use client";

import type { ChangeEvent } from "react";

/**
 * Controlled fields — see formHooks.ts's useFormFields for why: React
 * resets a form's uncontrolled inputs after every action submission
 * (success or error), so defaultValue alone can't preserve what was typed
 * when a save fails.
 */

export function TextField({
  label,
  name,
  value,
  onChange,
  type = "text",
  error,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  error?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        aria-invalid={Boolean(error)}
        className={`w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-neutral-500 ${
          error ? "border-red-400" : "border-neutral-300"
        }`}
      />
      {error && (
        <p className="mt-1 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextAreaField({
  label,
  name,
  value,
  onChange,
  rows = 3,
  error,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  rows?: number;
  error?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <textarea
        name={name}
        value={value}
        onChange={onChange}
        rows={rows}
        aria-invalid={Boolean(error)}
        className={`w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-neutral-500 ${
          error ? "border-red-400" : "border-neutral-300"
        }`}
      />
      {error && (
        <p className="mt-1 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
