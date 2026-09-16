"use client";

import { useActionState, useRef } from "react";
import { addEducationAction, deleteEducationAction } from "./actions";
import type { Education } from "@/lib/content";
import { TextField, TextAreaField } from "@/app/_components/FormField";
import { SubmitButton } from "@/app/_components/SubmitButton";
import { ConfirmDeleteButton } from "@/app/_components/ConfirmDeleteButton";
import { FormBanner, fieldError } from "@/app/_components/FormBanner";
import { useRefreshOnSuccess, useResetOnSuccess, useIdempotencyKey, useFormFields } from "@/app/_components/formHooks";

const EMPTY_EDUCATION = { institution: "", program: "", startDate: "", endDate: "", description: "" };

function AddEducationForm() {
  const [state, formAction] = useActionState(addEducationAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  useRefreshOnSuccess(state);
  const idempotencyKey = useIdempotencyKey(state);
  const [values, handleChange, setValues] = useFormFields(EMPTY_EDUCATION);
  useResetOnSuccess(state, formRef, () => setValues(EMPTY_EDUCATION));

  return (
    <form ref={formRef} action={formAction} className="grid gap-3 border-t border-neutral-100 pt-4">
      <div>
        <p className="text-sm font-medium">Agregar educación</p>
        <p className="text-xs text-neutral-500">
          Se agregan una por una: completa y presiona Agregar. El formulario queda vacío, listo para la siguiente.
        </p>
      </div>
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <TextField label="Institución" name="institution" value={values.institution} onChange={handleChange} error={fieldError(state, "institution")} />
      <TextField label="Programa / título" name="program" value={values.program} onChange={handleChange} error={fieldError(state, "program")} />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Inicio (opcional)" name="startDate" value={values.startDate} onChange={handleChange} />
        <TextField label="Fin (vacío = en curso)" name="endDate" value={values.endDate} onChange={handleChange} />
      </div>
      <TextAreaField label="Descripción (opcional)" name="description" value={values.description} onChange={handleChange} rows={2} />
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

export function EducationSection({ education }: { education: Education[] }) {
  return (
    <section className="mb-10 rounded-xl border border-neutral-200 p-6">
      <h2 className="mb-4 text-lg font-semibold">Educación</h2>
      <ul className="mb-6 space-y-3">
        {education.map((edu) => (
          <li key={edu.id} className="flex items-start justify-between rounded-md border border-neutral-100 p-3">
            <div>
              <p className="font-medium">{edu.program}</p>
              <p className="text-sm text-neutral-500">{edu.institution}</p>
              <p className="text-sm text-neutral-500">
                {edu.startDate || "—"} — {edu.endDate || "En curso"}
              </p>
              {edu.description && <p className="mt-1 text-sm text-neutral-700">{edu.description}</p>}
            </div>
            <form action={deleteEducationAction}>
              <input type="hidden" name="id" value={edu.id} />
              <ConfirmDeleteButton />
            </form>
          </li>
        ))}
      </ul>
      <AddEducationForm />
    </section>
  );
}
