"use client";

import { useActionState, useRef, useState, type ChangeEventHandler } from "react";
import { useFormStatus } from "react-dom";
import { submitContactMessage } from "./actions";
import { useResetOnSuccess, useIdempotencyKey, useFormFields } from "@/app/_components/formHooks";
import { fieldError } from "@/app/_components/FormBanner";

const EMPTY_MESSAGE = { firstName: "", lastName: "", email: "", phone: "", body: "" };

export function ContactForm() {
  const [state, formAction] = useActionState(submitContactMessage, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const idempotencyKey = useIdempotencyKey(state);
  const [renderedAt] = useState(() => Date.now());
  const [values, handleChange, setValues] = useFormFields(EMPTY_MESSAGE);
  useResetOnSuccess(state, formRef, () => setValues(EMPTY_MESSAGE));

  return (
    <form ref={formRef} action={formAction} className="grid max-w-md gap-4">
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <input type="hidden" name="renderedAt" value={renderedAt} readOnly />
      {/* Honeypot: invisible to real visitors, a bot filling every field trips it. */}
      <div
        aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", top: "auto", width: 1, height: 1, overflow: "hidden" }}
      >
        <label htmlFor="website">Sitio web</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <ContactField label="nombre" name="firstName" required value={values.firstName} onChange={handleChange} error={fieldError(state, "firstName")} />
        <ContactField label="apellido" name="lastName" required value={values.lastName} onChange={handleChange} error={fieldError(state, "lastName")} />
      </div>
      <ContactField label="correo" name="email" type="email" required value={values.email} onChange={handleChange} error={fieldError(state, "email")} />
      <ContactField label="telefono" name="phone" type="tel" value={values.phone} onChange={handleChange} error={fieldError(state, "phone")} />
      <div>
        <label className="mb-1 block font-mono text-xs text-muted">mensaje *</label>
        <textarea
          name="body"
          required
          rows={4}
          value={values.body}
          onChange={handleChange}
          aria-invalid={Boolean(fieldError(state, "body"))}
          className="w-full border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-cyan"
        />
        {fieldError(state, "body") && <p className="mt-1 font-mono text-xs text-red-400">{fieldError(state, "body")}</p>}
      </div>

      <ContactSubmitButton />

      {state?.status === "success" && (
        <p role="status" aria-live="polite" className="border border-green px-4 py-3 font-mono text-sm text-green">
          {"// "}
          {state.message}
        </p>
      )}
      {state?.status === "error" && (
        <p role="alert" aria-live="assertive" className="border border-cyan px-4 py-3 font-mono text-sm text-cyan">
          {"// "}
          {state.message}
        </p>
      )}
    </form>
  );
}

function ContactSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-fit border border-cyan px-5 py-2 font-mono text-sm text-cyan transition hover:bg-cyan hover:text-[#06202c] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "enviando…" : "enviar"}
    </button>
  );
}

function ContactField({
  label,
  name,
  value,
  onChange,
  type = "text",
  required = false,
  error,
}: {
  label: string;
  name: string;
  value: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  type?: string;
  required?: boolean;
  error?: string;
}) {
  return (
    <div>
      <label className="mb-1 block font-mono text-xs text-muted">
        {label}
        {required ? " *" : ""}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        aria-invalid={Boolean(error)}
        className="w-full border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-cyan"
      />
      {error && <p className="mt-1 font-mono text-xs text-red-400">{error}</p>}
    </div>
  );
}
