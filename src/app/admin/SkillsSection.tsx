"use client";

import { useActionState, useRef } from "react";
import { addSkillAction, deleteSkillAction } from "./actions";
import type { Skill } from "@/lib/content";
import { TextField } from "@/app/_components/FormField";
import { SubmitButton } from "@/app/_components/SubmitButton";
import { ConfirmDeleteButton } from "@/app/_components/ConfirmDeleteButton";
import { FormBanner, fieldError } from "@/app/_components/FormBanner";
import { useRefreshOnSuccess, useResetOnSuccess, useIdempotencyKey, useFormFields } from "@/app/_components/formHooks";

const EMPTY_SKILL = { name: "", category: "" };

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
      <ul className="mb-6 flex flex-wrap gap-2">
        {skills.map((skill) => (
          <li key={skill.id} className="flex items-center gap-2 rounded-full border border-neutral-200 px-3 py-1 text-sm">
            {skill.name}
            <form action={deleteSkillAction}>
              <input type="hidden" name="id" value={skill.id} />
              <ConfirmDeleteButton idleLabel="×" confirmLabel="¿Sí?" pendingLabel="…" className="text-red-600 hover:underline" />
            </form>
          </li>
        ))}
      </ul>
      <AddSkillForm />
    </section>
  );
}
