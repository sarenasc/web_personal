/** Shared shape returned by useActionState-driven form actions, so every form can show pending/success/error/conflict consistently without losing what the user typed. */
export type ActionState = {
  status: "idle" | "success" | "error" | "conflict";
  message?: string;
  fieldErrors?: Record<string, string>;
  /** Echoes back the submitted field values so the form can restore them after a failed submit (the browser already keeps them via defaultValue on an uncontrolled form, but conflict/validation responses need it to re-render with the *attempted* values, not silently reset). */
  values?: Record<string, string>;
} | undefined;

export const IDLE_STATE: ActionState = { status: "idle" };

export function successState(message?: string): ActionState {
  return { status: "success", message };
}

export function errorState(message: string, fieldErrors?: Record<string, string>, values?: Record<string, string>): ActionState {
  return { status: "error", message, fieldErrors, values };
}

export function conflictState(message: string, values?: Record<string, string>): ActionState {
  return { status: "conflict", message, values };
}
