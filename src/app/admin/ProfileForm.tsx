"use client";

import { useActionState, useRef } from "react";
import { updateProfileAction } from "./actions";
import type { Profile } from "@/lib/content";
import { currentVersion } from "@/lib/version";
import { TextField, TextAreaField } from "@/app/_components/FormField";
import { SubmitButton } from "@/app/_components/SubmitButton";
import { FormBanner, fieldError } from "@/app/_components/FormBanner";
import { useRefreshOnSuccess, useIdempotencyKey, useFormFields } from "@/app/_components/formHooks";

export function ProfileForm({ profile }: { profile: Profile }) {
  const [state, formAction] = useActionState(updateProfileAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  useRefreshOnSuccess(state);
  const idempotencyKey = useIdempotencyKey(state);

  const [values, handleChange] = useFormFields({
    name: profile.name,
    title: profile.title,
    tagline: profile.tagline,
    bioShort: profile.bioShort,
    bioLong: profile.bioLong,
    location: profile.location,
    email: profile.email,
    linkedinUrl: profile.linkedinUrl,
    githubUrl: profile.githubUrl,
  });

  return (
    <form ref={formRef} action={formAction} className="grid gap-4">
      <input type="hidden" name="version" value={currentVersion(profile.version)} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <TextField label="Nombre" name="name" value={values.name} onChange={handleChange} error={fieldError(state, "name")} />
      <TextField label="Título / cargo" name="title" value={values.title} onChange={handleChange} error={fieldError(state, "title")} />
      <TextField label="Tagline" name="tagline" value={values.tagline} onChange={handleChange} />
      <TextAreaField label="Bio corta" name="bioShort" value={values.bioShort} onChange={handleChange} />
      <TextAreaField label="Historia personal" name="bioLong" value={values.bioLong} onChange={handleChange} rows={6} />
      <TextField label="Ubicación" name="location" value={values.location} onChange={handleChange} />
      <TextField label="Email" name="email" value={values.email} onChange={handleChange} error={fieldError(state, "email")} />
      <TextField
        label="LinkedIn"
        name="linkedinUrl"
        value={values.linkedinUrl}
        onChange={handleChange}
        error={fieldError(state, "linkedinUrl")}
      />
      <TextField
        label="GitHub"
        name="githubUrl"
        value={values.githubUrl}
        onChange={handleChange}
        error={fieldError(state, "githubUrl")}
      />
      <div>
        <label className="mb-1 block text-sm font-medium">Foto principal (hero)</label>
        {profile.heroPhotoUrl && <p className="mb-1 text-xs text-neutral-500">Actual: {profile.heroPhotoUrl}</p>}
        <input type="file" name="heroPhoto" accept="image/png,image/jpeg,image/webp,image/gif" className="text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Foto sección historia</label>
        {profile.aboutPhotoUrl && <p className="mb-1 text-xs text-neutral-500">Actual: {profile.aboutPhotoUrl}</p>}
        <input type="file" name="aboutPhoto" accept="image/png,image/jpeg,image/webp,image/gif" className="text-sm" />
      </div>
      <SubmitButton
        pendingLabel="Guardando…"
        className="mt-2 w-fit rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
      >
        Guardar perfil
      </SubmitButton>
      <FormBanner state={state} />
    </form>
  );
}
