"use server";

import { redirect } from "next/navigation";
import type { FormState } from "@/features/auth/form-state";
import { requireUser } from "@/server/auth/session";
import { saveProfile } from "@/server/services/profile-service";
import { profileDeps } from "@/server/services/profile-deps";

const GENERIC_ERROR = "No pudimos guardar tus datos. Probá de nuevo en un momento.";

async function save(formData: FormData, mode: "onboarding" | "edit"): Promise<FormState | null> {
  const user = await requireUser();
  const raw: Record<string, unknown> = {};
  for (const [key, value] of formData) {
    if (typeof value === "string") raw[key] = value;
  }
  try {
    const result = await saveProfile(await profileDeps(), user.id, raw, mode);
    if (!result.ok) {
      return { status: "error", message: "Revisá los datos marcados.", fieldErrors: result.fieldErrors };
    }
    return null;
  } catch {
    // El detalle ya quedó en el log del servidor (RepositoryError).
    return { status: "error", message: GENERIC_ERROR };
  }
}

export async function saveOnboardingAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const error = await save(formData, "onboarding");
  if (error) return error;
  redirect("/");
}

export async function updateProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const error = await save(formData, "edit");
  if (error) return error;
  return { status: "success", message: "¡Listo! Guardamos tus cambios y recalculamos tus metas." };
}
