"use client";

import { useActionState, useRef, useState } from "react";
import { addSkillAction, updateSkillAction, deleteSkillAction } from "./actions";
import type { Skill } from "@/lib/content";
import { currentVersion } from "@/lib/version";
import { TextField } from "@/app/_components/FormField";
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

const EMPTY_SKILL = { name: "", category: "" };

function SkillItem({ skill }: { skill: Skill }) {
  const [state, formAction] = useActionState(updateSkillAction, undefined);
  const idempotencyKey = useIdempotencyKey(state);
  const [open, setOpen] = useState(false);
  const [values, handleChange, setValues] = useFormFields({ name: skill.name, category: skill.category });

  useCloseOnSuccess(state, setOpen);
  useRefreshOnSuccess(state);

  function openEditor() {
    setValues({ name: skill.name, category: skill.category });
    setOpen(true);
  }

  return (
    <li className="rounded-md border border-neutral-100 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">{skill.name}</p>
          {skill.category && <p className="text-sm text-neutral-500">{skill.category}</p>}
        </div>
        <form action={deleteSkillAction}>
          <input type="hidden" name="id" value={skill.id} />
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
        <form action={formAction} className="mt-3 grid grid-cols-2 gap-3 border-t border-neutral-100 pt-3">
          <input type="hidden" name="id" value={skill.id} />
          <input type="hidden" name="version" value={currentVersion(skill.version)} />
          <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
          <TextField label="Nombre" name="name" value={values.name} onChange={handleChange} error={fieldError(state, "name")} />
          <TextField label="Categoría" name="category" value={values.category} onChange={handleChange} />
          <SubmitButton
            pendingLabel="Guardando…"
            className="col-span-2 w-fit rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
          >
            Guardar cambios
          </SubmitButton>
          <div className="col-span-2">
            <FormBanner state={state} />
          </div>
        </form>
      )}
    </li>
  );
}

function AddSkillForm() {
  const [state, formAction] = useActionState(addSkillAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  useRefreshOnSuccess(state);
  const idempotencyKey = useIdempotencyKey(state);
  const [values, handleChange, setValues] = useFormFields(EMPTY_SKILL);
  useResetOnSuccess(state, formRef, () => setValues(EMPTY_SKILL));

  return (
    <form ref={formRef} action={formAction} className="grid grid-cols-2 gap-3 border-t border-neutral-100 pt-4">
      <p className="col-span-2 text-xs text-neutral-500">Se agregan una por una: completa y presiona Agregar skill, cuantas veces quieras.</p>
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <TextField label="Nombre" name="name" value={values.name} onChange={handleChange} error={fieldError(state, "name")} />
      <TextField label="Categoría" name="category" value={values.category} onChange={handleChange} />
      <SubmitButton
        pendingLabel="Agregando…"
        className="col-span-2 w-fit rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
      >
        Agregar skill
      </SubmitButton>
      <div className="col-span-2">
        <FormBanner state={state} />
      </div>
    </form>
  );
}

export function SkillsSection({ skills }: { skills: Skill[] }) {
  return (
    <section className="mb-10 rounded-xl border border-neutral-200 p-6">
      <h2 className="mb-4 text-lg font-semibold">Skills</h2>
      <ul className="mb-6 space-y-3">
        {skills.map((skill) => (
          <SkillItem key={skill.id} skill={skill} />
        ))}
      </ul>
      <AddSkillForm />
    </section>
  );
}
