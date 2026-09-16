"use server";

import { addMessage } from "@/lib/messages";
import { checkRateLimit } from "@/lib/ratelimit";
import { claimIdempotencyKey } from "@/lib/idempotency";
import { getClientIpHash } from "@/lib/requestMeta";
import {
  trimmedString,
  requireNonEmpty,
  requireMaxLength,
  requireEmail,
  isHoneypotTripped,
  isSubmittedTooFast,
} from "@/lib/validate";
import { type ActionState, errorState, successState } from "@/lib/actionState";

const SUCCESS_MESSAGE = "Mensaje enviado. Gracias, te responderé pronto.";

export async function submitContactMessage(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const fields = {
    firstName: trimmedString(formData, "firstName", 100),
    lastName: trimmedString(formData, "lastName", 100),
    email: trimmedString(formData, "email", 200),
    phone: trimmedString(formData, "phone", 50),
    body: trimmedString(formData, "body", 5000),
  };

  // Silent spam rejection: report the same success a real visitor sees, so
  // an automated submission gets no signal about what tripped it.
  if (isHoneypotTripped(formData) || isSubmittedTooFast(formData)) {
    return successState(SUCCESS_MESSAGE);
  }

  const errors: Record<string, string> = {};
  requireNonEmpty(fields.firstName, "firstName", errors, "Nombre");
  requireNonEmpty(fields.lastName, "lastName", errors, "Apellido");
  requireNonEmpty(fields.email, "email", errors, "Correo");
  requireEmail(fields.email, "email", errors);
  requireNonEmpty(fields.body, "body", errors, "Mensaje");
  requireMaxLength(fields.body, "body", 5000, errors, "Mensaje");
  requireMaxLength(fields.phone, "phone", 50, errors, "Teléfono");
  if (Object.keys(errors).length > 0) {
    return errorState("Revisa los campos marcados.", errors, fields);
  }

  const ipHash = await getClientIpHash();
  const rl = await checkRateLimit(`contact:${ipHash}`, { windowMs: 60 * 60 * 1000, max: 5 });
  if (!rl.allowed) {
    return errorState("Enviaste varios mensajes seguidos. Intenta de nuevo más tarde.", undefined, fields);
  }

  const idempotencyKey = trimmedString(formData, "idempotencyKey", 100);
  if (idempotencyKey && !(await claimIdempotencyKey(`contact:${idempotencyKey}`))) {
    return successState(SUCCESS_MESSAGE); // identical resubmit — already sent
  }

  try {
    await addMessage(fields);
  } catch {
    return errorState("No se pudo enviar el mensaje. Intenta de nuevo en un momento.", undefined, fields);
  }

  return successState(SUCCESS_MESSAGE);
}
