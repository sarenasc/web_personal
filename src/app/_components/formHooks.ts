"use client";

import { useEffect, useRef, useState, type ChangeEvent, type RefObject } from "react";
import { useRouter } from "next/navigation";
import type { ActionState } from "@/lib/actionState";

/**
 * A fresh idempotency key per mount, rotated only after a *successful*
 * submit. A resubmit while the previous attempt is still pending, still
 * shows an error, or is a plain accidental double-click carries the same
 * key (so the server recognizes and absorbs the repeat); a genuinely new
 * save after success gets a new one.
 */
export function useIdempotencyKey(state: ActionState): string {
  const [key, setKey] = useState<string>(() => crypto.randomUUID());
  const lastHandled = useRef<ActionState>(undefined);
  useEffect(() => {
    if (state && state.status === "success" && state !== lastHandled.current) {
      lastHandled.current = state;
      setKey(crypto.randomUUID());
    }
  }, [state]);
  return key;
}

/** Re-fetches the server-rendered page data after a successful save/delete, so the form's hidden `version` field and any list below it reflect the new state without a full reload. */
export function useRefreshOnSuccess(state: ActionState) {
  const router = useRouter();
  const lastHandled = useRef<ActionState>(undefined);
  useEffect(() => {
    if (state && state.status === "success" && state !== lastHandled.current) {
      lastHandled.current = state;
      router.refresh();
    }
  }, [state, router]);
}

/**
 * React resets a <form>'s uncontrolled fields automatically after every
 * action submission — success OR error (it mirrors native form-submit
 * semantics). That's fine for a successful "add" (the form should clear for
 * the next entry) but wrong for a failed one: the review specifically asks
 * that a validation/conflict error preserve what was typed. The only
 * reliable way to do that is to drive the fields as controlled inputs from
 * component state instead of relying on defaultValue, since defaultValue is
 * only read once at mount and can't "win back" a value React just cleared.
 */
export function useFormFields<T extends Record<string, string>>(initial: T) {
  const [values, setValues] = useState<T>(initial);
  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setValues((prev) => ({ ...prev, [name]: value }));
  };
  return [values, handleChange, setValues] as const;
}

/** Collapses an edit disclosure back to view mode once its save succeeds, so the closed summary (always rendered from fresh props) is what's shown instead of a controlled form that could go stale against a later router.refresh(). */
export function useCloseOnSuccess(state: ActionState, setOpen: (open: boolean) => void) {
  const lastHandled = useRef<ActionState>(undefined);
  useEffect(() => {
    if (state && state.status === "success" && state !== lastHandled.current) {
      lastHandled.current = state;
      setOpen(false);
    }
  }, [state, setOpen]);
}

/**
 * Runs `onSuccess` once for each new successful state — used by "Agregar"
 * forms to clear their file input (native form.reset(), the one thing that
 * still needs it) and reset controlled text field state, readying the form
 * for the next entry. Never runs on error/conflict.
 */
export function useResetOnSuccess(
  state: ActionState,
  formRef: RefObject<HTMLFormElement | null>,
  onSuccess?: () => void
) {
  const lastHandled = useRef<ActionState>(undefined);
  useEffect(() => {
    if (state && state.status === "success" && state !== lastHandled.current) {
      lastHandled.current = state;
      formRef.current?.reset();
      onSuccess?.();
    }
  }, [state, formRef, onSuccess]);
}
