"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { createSessionToken, COOKIE_NAME } from "@/lib/auth";
import { getContent, saveContent, uploadPhoto } from "@/lib/content";

export async function loginAction(_prevState: { error: string } | undefined, formData: FormData) {
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
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  redirect("/admin");
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
  redirect("/admin/login");
}

export async function updateProfileAction(formData: FormData) {
  const content = await getContent();

  content.profile = {
    ...content.profile,
    name: String(formData.get("name") ?? ""),
    title: String(formData.get("title") ?? ""),
    tagline: String(formData.get("tagline") ?? ""),
    bioShort: String(formData.get("bioShort") ?? ""),
    bioLong: String(formData.get("bioLong") ?? ""),
    location: String(formData.get("location") ?? ""),
    email: String(formData.get("email") ?? ""),
    linkedinUrl: String(formData.get("linkedinUrl") ?? ""),
    githubUrl: String(formData.get("githubUrl") ?? ""),
  };

  const heroPhoto = formData.get("heroPhoto");
  if (heroPhoto instanceof File && heroPhoto.size > 0) {
    content.profile.heroPhotoUrl = await uploadPhoto(heroPhoto, "hero");
  }

  const aboutPhoto = formData.get("aboutPhoto");
  if (aboutPhoto instanceof File && aboutPhoto.size > 0) {
    content.profile.aboutPhotoUrl = await uploadPhoto(aboutPhoto, "about");
  }

  await saveContent(content);
  redirect("/admin");
}

export async function addExperienceAction(formData: FormData) {
  const content = await getContent();

  let logoUrl = "";
  const logo = formData.get("logo");
  if (logo instanceof File && logo.size > 0) {
    logoUrl = await uploadPhoto(logo, "logo");
  }

  content.experience.push({
    id: randomUUID(),
    company: String(formData.get("company") ?? ""),
    role: String(formData.get("role") ?? ""),
    startDate: String(formData.get("startDate") ?? ""),
    endDate: String(formData.get("endDate") ?? ""),
    description: String(formData.get("description") ?? ""),
    logoUrl,
  });

  await saveContent(content);
  redirect("/admin");
}

export async function updateExperienceAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const content = await getContent();
  const exp = content.experience.find((e) => e.id === id);
  if (!exp) redirect("/admin");

  exp.company = String(formData.get("company") ?? "");
  exp.role = String(formData.get("role") ?? "");
  exp.startDate = String(formData.get("startDate") ?? "");
  exp.endDate = String(formData.get("endDate") ?? "");
  exp.description = String(formData.get("description") ?? "");

  const logo = formData.get("logo");
  if (logo instanceof File && logo.size > 0) {
    exp.logoUrl = await uploadPhoto(logo, "logo");
  }

  await saveContent(content);
  redirect("/admin");
}

export async function deleteExperienceAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const content = await getContent();
  content.experience = content.experience.filter((exp) => exp.id !== id);
  await saveContent(content);
  redirect("/admin");
}

export async function addSkillAction(formData: FormData) {
  const content = await getContent();
  content.skills.push({
    id: randomUUID(),
    name: String(formData.get("name") ?? ""),
    category: String(formData.get("category") ?? ""),
  });
  await saveContent(content);
  redirect("/admin");
}

export async function deleteSkillAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const content = await getContent();
  content.skills = content.skills.filter((skill) => skill.id !== id);
  await saveContent(content);
  redirect("/admin");
}

export async function addEducationAction(formData: FormData) {
  const content = await getContent();
  content.education.push({
    id: randomUUID(),
    institution: String(formData.get("institution") ?? ""),
    program: String(formData.get("program") ?? ""),
    startDate: String(formData.get("startDate") ?? ""),
    endDate: String(formData.get("endDate") ?? ""),
    description: String(formData.get("description") ?? ""),
  });
  await saveContent(content);
  redirect("/admin");
}

export async function deleteEducationAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const content = await getContent();
  content.education = content.education.filter((edu) => edu.id !== id);
  await saveContent(content);
  redirect("/admin");
}

export async function deleteMessageAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const content = await getContent();
  content.messages = content.messages.filter((msg) => msg.id !== id);
  await saveContent(content);
  redirect("/admin");
}
