"use server";

import { redirect } from "next/navigation";
import { randomUUID } from "crypto";
import { getContent, saveContent } from "@/lib/content";

export async function submitContactMessage(formData: FormData) {
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (!firstName || !lastName || !email || !body) {
    redirect("/?enviado=0");
  }

  const content = await getContent();
  content.messages.push({
    id: randomUUID(),
    firstName,
    lastName,
    email,
    phone,
    body,
    createdAt: new Date().toISOString(),
  });
  await saveContent(content);

  redirect("/?enviado=1");
}
