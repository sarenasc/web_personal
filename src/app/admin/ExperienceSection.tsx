"use client";

import { useActionState, useRef, useState } from "react";
import { addExperienceAction, updateExperienceAction, deleteExperienceAction } from "./actions";
import type { Experience } from "@/lib/content";
import { currentVersion } from "@/lib/version";
import { TextField, TextAreaField } from "@/app/_components/FormField";
import { SubmitButton } from "@/app/_components/SubmitButton";
import { ConfirmDeleteButton } from "@/app/_components/ConfirmDeleteButton";
import { FormBanner, fieldError } from "@/app/_components/FormBanner";
import {
  useRefreshOnSuccess,
  useResetOnSuccess,
  useIdempotencyKey,
  useFormFields,
  useCloseOnSuccess,
} from "@/app/_components/formHooks";

const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

const EMPTY_EXPERIENCE = { company: "", role: "", startDate: "", endDate: "", description: "" };

function ExperienceItem({ exp }: { exp: Experience }) {
  const [state, formAction] = useActionState(updateExperienceAction, undefined);
  const idempotencyKey = useIdempotencyKey(state);
  const [open, setOpen] = useState(false);
  const [values, handleChange, setValues] = useFormFields({
    company: exp.company,
    role: exp.role,
    startDate: exp.startDate,
    endDate: exp.endDate,
    description: exp.description,
  });

  // Closing the edit form on success (rather than keeping it open with
  // now-committed values) sidesteps the staleness a controlled form would
  // otherwise have against a router.refresh()-delivered prop update.
  useCloseOnSuccess(state, setOpen);
  useRefreshOnSuccess(state);

  function openEditor() {
    // Re-derive from whatever the current (possibly refreshed-since-last-open) prop is, not whatever was typed the first time this was opened.
    setValues({
      company: exp.company,
      role: exp.role,
      startDate: exp.startDate,
      endDate: exp.endDate,
      description: exp.description,
    });
    setOpen(true);
  }

  return (
    <li className="rounded-md border border-neutral-100 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">
            {exp.role} · {exp.company}
          </p>
          <p className="text-sm text-neutral-500">
            {exp.startDate} — {exp.endDate || "Presente"}
          </p>
          <p className="mt-1 text-sm text-neutral-700">{exp.description}</p>
        </div>
        <form action={deleteExperienceAction}>
          <input type="hidden" name="id" value={exp.id} />
          <ConfirmDeleteButton />
        </form>
      </div>
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openEditor())}
        className="mt-2 text-sm text-neutral-600 hover:underline"
      >
        {open ? "Cerrar" : "Editar"}
      </button>
      {open && (
        <form action={formAction} className="mt-3 grid gap-3 border-t border-neutral-100 pt-3">
          <input type="hidden" name="id" value={exp.id} />
          <input type="hidden" name="version" value={currentVersion(exp.version)} />
          <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
          <TextField label="Empresa" name="company" value={values.company} onChange={handleChange} error={fieldError(state, "company")} />
          <TextField label="Cargo" name="role" value={values.role} onChange={handleChange} error={fieldError(state, "role")} />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Inicio" name="startDate" value={values.startDate} onChange={handleChange} />
            <TextField label="Fin (vacío = presente)" name="endDate" value={values.endDate} onChange={handleChange} />
          </div>
          <TextAreaField label="Descripción" name="description" value={values.description} onChange={handleChange} rows={3} />
          <div>
            <label className="mb-1 block text-sm font-medium">Logo (opcional)</label>
            {exp.logoUrl && <p className="mb-1 text-xs text-neutral-500">Actual: {exp.logoUrl}</p>}
            <input type="file" name="logo" accept={IMAGE_ACCEPT} className="text-sm" />
            {exp.logoUrl && (
              <label className="mt-1 flex items-center gap-1.5 text-xs text-neutral-600">
                <input type="checkbox" name="removeLogo" value="on" /> Quitar logo actual
              </label>
            )}
          </div>
          <SubmitButton
            pendingLabel="Guardando…"
            className="w-fit rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
          >
            Guardar cambios
          </SubmitButton>
          <FormBanner state={state} />
        </form>
      )}
    </li>
  );
}

function AddExperienceForm() {
  const [state, formAction] = useActionState(addExperienceAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  useRefreshOnSuccess(state);
  const idempotencyKey = useIdempotencyKey(state);
  const [values, handleChange, setValues] = useFormFields(EMPTY_EXPERIENCE);
  useResetOnSuccess(state, formRef, () => setValues(EMPTY_EXPERIENCE));

  return (
    <form ref={formRef} action={formAction} className="grid gap-3 border-t border-neutral-100 pt-4">
      <div>
        <p className="text-sm font-medium">Agregar experiencia</p>
        <p className="text-xs text-neutral-500">
          Se agregan una por una: completa y presiona Agregar. El formulario queda vacío, listo para la siguiente.
        </p>
      </div>
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <TextField label="Empresa" name="company" value={values.company} onChange={handleChange} error={fieldError(state, "company")} />
      <TextField label="Cargo" name="role" value={values.role} onChange={handleChange} error={fieldError(state, "role")} />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Inicio (ej. 2016)" name="startDate" value={values.startDate} onChange={handleChange} />
        <TextField label="Fin (vacío = presente)" name="endDate" value={values.endDate} onChange={handleChange} />
      </div>
      <TextAreaField label="Descripción" name="description" value={values.description} onChange={handleChange} rows={3} />
      <div>
        <label className="mb-1 block text-sm font-medium">Logo (opcional)</label>
        <input type="file" name="logo" accept={IMAGE_ACCEPT} className="text-sm" />
      </div>
      <SubmitButton
        pendingLabel="Agregando…"
        className="mt-1 w-fit rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
      >
        Agregar
      </SubmitButton>
      <FormBanner state={state} />
    </form>
  );
}

export function ExperienceSection({ experience }: { experience: Experience[] }) {
  return (
    <section className="mb-10 rounded-xl border border-neutral-200 p-6">
      <h2 className="mb-4 text-lg font-semibold">Experiencia</h2>
      <ul className="mb-6 space-y-3">
        {experience.map((exp) => (
          <ExperienceItem key={exp.id} exp={exp} />
        ))}
      </ul>
      <AddExperienceForm />
    </section>
  );
}
