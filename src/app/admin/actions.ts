"use server";

import { redirect } from "next/navigation";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import {
  createSessionToken,
  setSessionCookie,
  clearSessionCookie,
  requireAdmin,
} from "@/lib/auth";
import { updateContent, uploadPhoto, deleteUploadedFile, currentVersion, ConflictError } from "@/lib/content";
import { deleteMessage as deleteMessageFromStore } from "@/lib/messages";
import { checkRateLimit } from "@/lib/ratelimit";
import { claimIdempotencyKey } from "@/lib/idempotency";
import { getClientIpHash } from "@/lib/requestMeta";
import { trimmedString, requireNonEmpty, requireMaxLength, requireEmail, requireUrlOrEmpty } from "@/lib/validate";
import { InvalidImageError } from "@/lib/images";
import { type ActionState, errorState, conflictState, successState } from "@/lib/actionState";

async function uploadPhotoField(
  formData: FormData,
  field: string
): Promise<{ url: string | null; error: string | null }> {
  const file = formData.get(field);
  if (!(file instanceof File) || file.size === 0) return { url: null, error: null };
  try {
    return { url: await uploadPhoto(file, field), error: null };
  } catch (err) {
    const message = err instanceof InvalidImageError ? err.message : "No se pudo procesar la imagen.";
    return { url: null, error: message };
  }
}

export async function loginAction(
  _prevState: { error: string } | undefined,
  formData: FormData
): Promise<{ error: string } | undefined> {
  const ipHash = await getClientIpHash();
  const rl = await checkRateLimit(`login:${ipHash}`, { windowMs: 15 * 60 * 1000, max: 5 });
  if (!rl.allowed) {
    const minutes = Math.max(1, Math.ceil((rl.retryAfterSeconds ?? 60) / 60));
    return { error: `Demasiados intentos. Espera ${minutes} minuto(s) y vuelve a intentar.` };
  }

  const password = String(formData.get("password") ?? "");
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!hash) {
    return { error: "ADMIN_PASSWORD_HASH no está configurado en el servidor." };
  }

  const valid = await bcrypt.compare(password, hash);
  if (!valid) {
    return { error: "Contraseña incorrecta." };
  }

  const token = await createSessionToken();
  await setSessionCookie(token);
  redirect("/admin");
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/admin/login");
}

export async function updateProfileAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const fields = {
    name: trimmedString(formData, "name", 200),
    title: trimmedString(formData, "title", 200),
    tagline: trimmedString(formData, "tagline", 300),
    bioShort: trimmedString(formData, "bioShort", 500),
    bioLong: trimmedString(formData, "bioLong", 5000),
    location: trimmedString(formData, "location", 200),
    email: trimmedString(formData, "email", 200),
    linkedinUrl: trimmedString(formData, "linkedinUrl", 500),
    githubUrl: trimmedString(formData, "githubUrl", 500),
  };
  const submittedVersion = Number(formData.get("version") ?? "1");
  const idempotencyKey = trimmedString(formData, "idempotencyKey", 100);

  const errors: Record<string, string> = {};
  requireNonEmpty(fields.name, "name", errors, "Nombre");
  requireNonEmpty(fields.title, "title", errors, "Título");
  requireEmail(fields.email, "email", errors);
  requireUrlOrEmpty(fields.linkedinUrl, "linkedinUrl", errors);
  requireUrlOrEmpty(fields.githubUrl, "githubUrl", errors);
  if (Object.keys(errors).length > 0) {
    return errorState("Revisa los campos marcados.", errors, fields);
  }

  // Checked before the version-conflict logic below: a double-click resubmit
  // carries the same key and should be absorbed silently, not surfaced as a
  // (false) "someone else changed this" conflict.
  if (idempotencyKey && !(await claimIdempotencyKey(`update-profile:${idempotencyKey}`))) {
    return successState("Perfil guardado.");
  }

  const hero = await uploadPhotoField(formData, "heroPhoto");
  if (hero.error) return errorState(hero.error, undefined, fields);
  const about = await uploadPhotoField(formData, "aboutPhoto");
  if (about.error) {
    if (hero.url) await deleteUploadedFile(hero.url);
    return errorState(about.error, undefined, fields);
  }

  let previousHeroUrl: string | undefined;
  let previousAboutUrl: string | undefined;
  try {
    await updateContent((content) => {
      if (currentVersion(content.profile.version) !== submittedVersion) {
        throw new ConflictError("El perfil fue modificado en otra sesión mientras editabas. Revisa los valores actuales.");
      }
      previousHeroUrl = content.profile.heroPhotoUrl;
      previousAboutUrl = content.profile.aboutPhotoUrl;
      content.profile = { ...content.profile, ...fields, version: currentVersion(content.profile.version) + 1 };
      if (hero.url) content.profile.heroPhotoUrl = hero.url;
      if (about.url) content.profile.aboutPhotoUrl = about.url;
    });
  } catch (err) {
    if (hero.url) await deleteUploadedFile(hero.url);
    if (about.url) await deleteUploadedFile(about.url);
    if (err instanceof ConflictError) return conflictState(err.message, fields);
    return errorState("No se pudo guardar el perfil. Intenta de nuevo.", undefined, fields);
  }

  if (hero.url && previousHeroUrl) void deleteUploadedFile(previousHeroUrl);
  if (about.url && previousAboutUrl) void deleteUploadedFile(previousAboutUrl);
  return successState("Perfil guardado.");
}

export async function addExperienceAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const idempotencyKey = trimmedString(formData, "idempotencyKey", 100);
  const fields = {
    company: trimmedString(formData, "company", 200),
    role: trimmedString(formData, "role", 200),
    startDate: trimmedString(formData, "startDate", 50),
    endDate: trimmedString(formData, "endDate", 50),
    description: trimmedString(formData, "description", 3000),
  };

  const errors: Record<string, string> = {};
  requireNonEmpty(fields.company, "company", errors, "Empresa");
  requireNonEmpty(fields.role, "role", errors, "Cargo");
  requireMaxLength(fields.description, "description", 3000, errors, "Descripción");
  if (Object.keys(errors).length > 0) {
    return errorState("Revisa los campos marcados.", errors, fields);
  }

  if (idempotencyKey && !(await claimIdempotencyKey(`add-experience:${idempotencyKey}`))) {
    return successState("Experiencia agregada."); // identical resubmit — already applied
  }

  const logo = await uploadPhotoField(formData, "logo");
  if (logo.error) return errorState(logo.error, undefined, fields);

  try {
    await updateContent((content) => {
      content.experience.push({ id: randomUUID(), ...fields, logoUrl: logo.url ?? "", version: 1 });
    });
  } catch {
    if (logo.url) await deleteUploadedFile(logo.url);
    return errorState("No se pudo agregar la experiencia. Intenta de nuevo.", undefined, fields);
  }

  return successState("Experiencia agregada.");
}

export async function updateExperienceAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const id = trimmedString(formData, "id", 100);
  const submittedVersion = Number(formData.get("version") ?? "1");
  const idempotencyKey = trimmedString(formData, "idempotencyKey", 100);
  const fields = {
    company: trimmedString(formData, "company", 200),
    role: trimmedString(formData, "role", 200),
    startDate: trimmedString(formData, "startDate", 50),
    endDate: trimmedString(formData, "endDate", 50),
    description: trimmedString(formData, "description", 3000),
  };

  const errors: Record<string, string> = {};
  requireNonEmpty(fields.company, "company", errors, "Empresa");
  requireNonEmpty(fields.role, "role", errors, "Cargo");
  if (Object.keys(errors).length > 0) {
    return errorState("Revisa los campos marcados.", errors, fields);
  }

  if (idempotencyKey && !(await claimIdempotencyKey(`update-experience:${idempotencyKey}`))) {
    return successState("Cambios guardados.");
  }

  const logo = await uploadPhotoField(formData, "logo");
  if (logo.error) return errorState(logo.error, undefined, fields);

  let previousLogoUrl: string | undefined;
  try {
    await updateContent((content) => {
      const exp = content.experience.find((e) => e.id === id);
      if (!exp) {
        throw new ConflictError("Este registro ya no existe (probablemente se eliminó en otra sesión).");
      }
      if (currentVersion(exp.version) !== submittedVersion) {
        throw new ConflictError("Este registro se modificó en otra sesión mientras lo editabas. Revisa los valores actuales.");
      }
      previousLogoUrl = exp.logoUrl;
      Object.assign(exp, fields);
      exp.version = currentVersion(exp.version) + 1;
      if (logo.url) exp.logoUrl = logo.url;
    });
  } catch (err) {
    if (logo.url) await deleteUploadedFile(logo.url);
    if (err instanceof ConflictError) return conflictState(err.message, fields);
    return errorState("No se pudo guardar los cambios. Intenta de nuevo.", undefined, fields);
  }

  if (logo.url && previousLogoUrl) void deleteUploadedFile(previousLogoUrl);
  return successState("Cambios guardados.");
}

export async function deleteExperienceAction(formData: FormData) {
  await requireAdmin();
  const id = trimmedString(formData, "id", 100);
  let logoToDelete: string | undefined;
  await updateContent((content) => {
    const exp = content.experience.find((e) => e.id === id);
    logoToDelete = exp?.logoUrl;
    content.experience = content.experience.filter((e) => e.id !== id);
  });
  if (logoToDelete) void deleteUploadedFile(logoToDelete);
  redirect("/admin");
}

export async function addSkillAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const idempotencyKey = trimmedString(formData, "idempotencyKey", 100);
  const fields = {
    name: trimmedString(formData, "name", 100),
    category: trimmedString(formData, "category", 100),
  };

  const errors: Record<string, string> = {};
  requireNonEmpty(fields.name, "name", errors, "Nombre");
  if (Object.keys(errors).length > 0) {
    return errorState("Revisa los campos marcados.", errors, fields);
  }

  if (idempotencyKey && !(await claimIdempotencyKey(`add-skill:${idempotencyKey}`))) {
    return successState("Skill agregado.");
  }

  await updateContent((content) => {
    content.skills.push({ id: randomUUID(), ...fields });
  });
  return successState("Skill agregado.");
}

export async function deleteSkillAction(formData: FormData) {
  await requireAdmin();
  const id = trimmedString(formData, "id", 100);
  await updateContent((content) => {
    content.skills = content.skills.filter((skill) => skill.id !== id);
  });
  redirect("/admin");
}

export async function addEducationAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const idempotencyKey = trimmedString(formData, "idempotencyKey", 100);
  const fields = {
    institution: trimmedString(formData, "institution", 200),
    program: trimmedString(formData, "program", 200),
    startDate: trimmedString(formData, "startDate", 50),
    endDate: trimmedString(formData, "endDate", 50),
    description: trimmedString(formData, "description", 2000),
  };

  const errors: Record<string, string> = {};
  requireNonEmpty(fields.institution, "institution", errors, "Institución");
  requireNonEmpty(fields.program, "program", errors, "Programa");
  if (Object.keys(errors).length > 0) {
    return errorState("Revisa los campos marcados.", errors, fields);
  }

  if (idempotencyKey && !(await claimIdempotencyKey(`add-education:${idempotencyKey}`))) {
    return successState("Educación agregada.");
  }

  await updateContent((content) => {
    content.education.push({ id: randomUUID(), ...fields, version: 1 });
  });
  return successState("Educación agregada.");
}

export async function updateEducationAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const id = trimmedString(formData, "id", 100);
  const submittedVersion = Number(formData.get("version") ?? "1");
  const idempotencyKey = trimmedString(formData, "idempotencyKey", 100);
  const fields = {
    institution: trimmedString(formData, "institution", 200),
    program: trimmedString(formData, "program", 200),
    startDate: trimmedString(formData, "startDate", 50),
    endDate: trimmedString(formData, "endDate", 50),
    description: trimmedString(formData, "description", 2000),
  };

  const errors: Record<string, string> = {};
  requireNonEmpty(fields.institution, "institution", errors, "Institución");
  requireNonEmpty(fields.program, "program", errors, "Programa");
  if (Object.keys(errors).length > 0) {
    return errorState("Revisa los campos marcados.", errors, fields);
  }

  if (idempotencyKey && !(await claimIdempotencyKey(`update-education:${idempotencyKey}`))) {
    return successState("Cambios guardados.");
  }

  try {
    await updateContent((content) => {
      const edu = content.education.find((e) => e.id === id);
      if (!edu) {
        throw new ConflictError("Este registro ya no existe (probablemente se eliminó en otra sesión).");
      }
      if (currentVersion(edu.version) !== submittedVersion) {
        throw new ConflictError("Este registro se modificó en otra sesión mientras lo editabas. Revisa los valores actuales.");
      }
      Object.assign(edu, fields);
      edu.version = currentVersion(edu.version) + 1;
    });
  } catch (err) {
    if (err instanceof ConflictError) return conflictState(err.message, fields);
    return errorState("No se pudo guardar los cambios. Intenta de nuevo.", undefined, fields);
  }

  return successState("Cambios guardados.");
}

export async function deleteEducationAction(formData: FormData) {
  await requireAdmin();
  const id = trimmedString(formData, "id", 100);
  await updateContent((content) => {
    content.education = content.education.filter((edu) => edu.id !== id);
  });
  redirect("/admin");
}

export async function deleteMessageAction(formData: FormData) {
  await requireAdmin();
  const id = trimmedString(formData, "id", 100);
  await deleteMessageFromStore(id); // also requires admin internally (defense in depth)
  redirect("/admin");
}
