"use client";

import { useActionState, useState, type FormEvent } from "react";
import { z } from "zod";
import { initialFormState, type FormState } from "../form-state";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

/**
 * Valida con el MISMO esquema Zod que el servidor antes de enviar, para dar
 * feedback inmediato. Si pasa, envía la Server Action (que valida de nuevo).
 */
export function useValidatedAction(schema: z.ZodType, action: Action) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const [clientErrors, setClientErrors] = useState<FormState["fieldErrors"]>();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      event.preventDefault();
      setClientErrors(z.flattenError(parsed.error).fieldErrors as FormState["fieldErrors"]);
      return;
    }
    setClientErrors(undefined);
  }

  const fieldErrors = clientErrors ?? state.fieldErrors;
  return { state, formAction, pending, onSubmit, fieldErrors };
}
