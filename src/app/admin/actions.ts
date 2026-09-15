"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { createSessionToken, COOKIE_NAME } from "@/lib/auth";
import { updateContent, uploadPhoto } from "@/lib/content";

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
  const fields = {
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
  const heroPhotoUrl =
    heroPhoto instanceof File && heroPhoto.size > 0 ? await uploadPhoto(heroPhoto, "hero") : null;

  const aboutPhoto = formData.get("aboutPhoto");
  const aboutPhotoUrl =
    aboutPhoto instanceof File && aboutPhoto.size > 0 ? await uploadPhoto(aboutPhoto, "about") : null;

  await updateContent((content) => {
    content.profile = { ...content.profile, ...fields };
    if (heroPhotoUrl) content.profile.heroPhotoUrl = heroPhotoUrl;
    if (aboutPhotoUrl) content.profile.aboutPhotoUrl = aboutPhotoUrl;
  });

  redirect("/admin");
}

export async function addExperienceAction(formData: FormData) {
  const fields = {
    company: String(formData.get("company") ?? ""),
    role: String(formData.get("role") ?? ""),
    startDate: String(formData.get("startDate") ?? ""),
    endDate: String(formData.get("endDate") ?? ""),
    description: String(formData.get("description") ?? ""),
  };

  const logo = formData.get("logo");
  const logoUrl = logo instanceof File && logo.size > 0 ? await uploadPhoto(logo, "logo") : "";

  await updateContent((content) => {
    content.experience.push({ id: randomUUID(), ...fields, logoUrl });
  });

  redirect("/admin");
}

export async function updateExperienceAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const fields = {
    company: String(formData.get("company") ?? ""),
    role: String(formData.get("role") ?? ""),
    startDate: String(formData.get("startDate") ?? ""),
    endDate: String(formData.get("endDate") ?? ""),
    description: String(formData.get("description") ?? ""),
  };

  const logo = formData.get("logo");
  const logoUrl = logo instanceof File && logo.size > 0 ? await uploadPhoto(logo, "logo") : null;

  await updateContent((content) => {
    const exp = content.experience.find((e) => e.id === id);
    if (!exp) return;
    Object.assign(exp, fields);
    if (logoUrl) exp.logoUrl = logoUrl;
  });

  redirect("/admin");
}

export async function deleteExperienceAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  await updateContent((content) => {
    content.experience = content.experience.filter((exp) => exp.id !== id);
  });
  redirect("/admin");
}

export async function addSkillAction(formData: FormData) {
  const fields = {
    name: String(formData.get("name") ?? ""),
    category: String(formData.get("category") ?? ""),
  };
  await updateContent((content) => {
    content.skills.push({ id: randomUUID(), ...fields });
  });
  redirect("/admin");
}

export async function deleteSkillAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  await updateContent((content) => {
    content.skills = content.skills.filter((skill) => skill.id !== id);
  });
  redirect("/admin");
}

export async function addEducationAction(formData: FormData) {
  const fields = {
    institution: String(formData.get("institution") ?? ""),
    program: String(formData.get("program") ?? ""),
    startDate: String(formData.get("startDate") ?? ""),
    endDate: String(formData.get("endDate") ?? ""),
    description: String(formData.get("description") ?? ""),
  };
  await updateContent((content) => {
    content.education.push({ id: randomUUID(), ...fields });
  });
  redirect("/admin");
}

export async function deleteEducationAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  await updateContent((content) => {
    content.education = content.education.filter((edu) => edu.id !== id);
  });
  redirect("/admin");
}

export async function deleteMessageAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  await updateContent((content) => {
    content.messages = content.messages.filter((msg) => msg.id !== id);
  });
  redirect("/admin");
}
