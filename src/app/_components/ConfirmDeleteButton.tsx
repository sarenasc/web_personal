"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

/**
 * Two-click delete confirmation, meant to sit inside the `<form
 * action={deleteXAction}>` it submits. First click arms it (shows a
 * "¿Confirmar?" label for a few seconds); a second click within that window
 * actually submits the delete.
 *
 * Both states render a plain `type="button"` and submit imperatively via
 * `form.requestSubmit()` rather than ever rendering `type="submit"`.
 * Flipping the SAME button's type from "button" to "submit" inside its own
 * click handler is a real footgun: the browser evaluates a click's default
 * action (submit the form) using the button's type *after* React's
 * synchronous re-render from that same click has already applied — so the
 * very first click ends up submitting the form immediately, defeating the
 * confirmation entirely. requestSubmit() sidesteps that by never relying on
 * the browser's implicit submit-button behavior.
 */
export function ConfirmDeleteButton({
  idleLabel = "Eliminar",
  confirmLabel = "¿Confirmar?",
  pendingLabel = "Eliminando…",
  className = "text-sm text-red-600 hover:underline",
}: {
  idleLabel?: string;
  confirmLabel?: string;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  const [confirming, setConfirming] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  if (pending) {
    return (
      <span aria-busy="true" className={className}>
        {pendingLabel}
      </span>
    );
  }

  if (!confirming) {
    return (
      <button
        type="button"
        className={className}
        onClick={() => {
          setConfirming(true);
          timeoutRef.current = setTimeout(() => setConfirming(false), 4000);
        }}
      >
        {idleLabel}
      </button>
    );
  }

  return (
    <button
      type="button"
      className={className}
      autoFocus
      onClick={(e) => {
        e.currentTarget.form?.requestSubmit();
      }}
    >
      {confirmLabel}
    </button>
  );
}
