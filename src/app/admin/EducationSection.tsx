"use client";

import { useActionState, useRef, useState } from "react";
import { addEducationAction, updateEducationAction, deleteEducationAction } from "./actions";
import type { Education } from "@/lib/content";
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

const EMPTY_EDUCATION = { institution: "", program: "", startDate: "", endDate: "", description: "" };

function EducationItem({ edu }: { edu: Education }) {
  const [state, formAction] = useActionState(updateEducationAction, undefined);
  const idempotencyKey = useIdempotencyKey(state);
  const [open, setOpen] = useState(false);
  const [values, handleChange, setValues] = useFormFields({
    institution: edu.institution,
    program: edu.program,
    startDate: edu.startDate,
    endDate: edu.endDate,
    description: edu.description,
  });

  useCloseOnSuccess(state, setOpen);
  useRefreshOnSuccess(state);

  function openEditor() {
    setValues({
      institution: edu.institution,
      program: edu.program,
      startDate: edu.startDate,
      endDate: edu.endDate,
      description: edu.description,
    });
    setOpen(true);
  }

  return (
    <li className="rounded-md border border-neutral-100 p-3">
      <div className="flex items-start justify-between gap-2">
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
          <input type="hidden" name="id" value={edu.id} />
          <input type="hidden" name="version" value={currentVersion(edu.version)} />
          <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
          <TextField
            label="Institución"
            name="institution"
            value={values.institution}
            onChange={handleChange}
            error={fieldError(state, "institution")}
          />
          <TextField
            label="Programa / título"
            name="program"
            value={values.program}
            onChange={handleChange}
            error={fieldError(state, "program")}
          />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Inicio (opcional)" name="startDate" value={values.startDate} onChange={handleChange} />
            <TextField label="Fin (vacío = en curso)" name="endDate" value={values.endDate} onChange={handleChange} />
          </div>
          <TextAreaField label="Descripción (opcional)" name="description" value={values.description} onChange={handleChange} rows={2} />
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
          <EducationItem key={edu.id} edu={edu} />
        ))}
      </ul>
      <AddEducationForm />
    </section>
  );
}
