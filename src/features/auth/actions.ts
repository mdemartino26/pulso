"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNextPath } from "@/lib/auth/redirect";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "@/lib/validation/auth";
import * as auth from "@/server/services/auth-service";
import type { FormState } from "./form-state";
import { AUTH_MESSAGES } from "./messages";

/*
 * Server Actions de autenticación. Next.js las protege de CSRF comparando
 * el Origin con el Host. Igual se valida TODO otra vez con Zod: lo que
 * manda el navegador nunca es confiable.
 */

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function invalid(error: z.ZodError): FormState {
  return { status: "error", fieldErrors: z.flattenError(error).fieldErrors };
}

function failed(result: auth.AuthResult, email?: string): FormState {
  const code = result.ok ? "unknown" : result.code;
  return { status: "error", message: AUTH_MESSAGES[code], ...(email ? { email } : {}) };
}

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signInSchema.safeParse({
    email: text(formData, "email"),
    password: text(formData, "password"),
  });
  if (!parsed.success) return invalid(parsed.error);

  const result = await auth.signInWithPassword(parsed.data.email, parsed.data.password);
  if (!result.ok) return failed(result, parsed.data.email);

  redirect(safeNextPath(text(formData, "next")));
}

export async function signUpAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signUpSchema.safeParse({
    email: text(formData, "email"),
    password: text(formData, "password"),
    confirmPassword: text(formData, "confirmPassword"),
  });
  if (!parsed.success) return invalid(parsed.error);

  const result = await auth.signUp(parsed.data.email, parsed.data.password);
  if (!result.ok) return failed(result, parsed.data.email);

  // Mismo mensaje exista o no la cuenta (no revelar quién está registrado).
  return {
    status: "success",
    message: "¡Listo! Te mandamos un mail para confirmar tu cuenta. Abrí el link y volvé a entrar.",
  };
}

export async function forgotPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = forgotPasswordSchema.safeParse({ email: text(formData, "email") });
  if (!parsed.success) return invalid(parsed.error);

  const result = await auth.requestPasswordReset(parsed.data.email);
  if (!result.ok) return failed(result);

  return {
    status: "success",
    message: "Si hay una cuenta con ese email, te llega un link para crear una contraseña nueva.",
  };
}

export async function resetPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse({
    password: text(formData, "password"),
    confirmPassword: text(formData, "confirmPassword"),
  });
  if (!parsed.success) return invalid(parsed.error);

  const result = await auth.updatePassword(parsed.data.password);
  if (!result.ok) return failed(result);

  redirect("/");
}

export async function signOutAction(): Promise<void> {
  await auth.signOut();
  redirect("/login");
}
