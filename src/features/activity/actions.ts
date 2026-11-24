"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/features/auth/form-state";
import { requireUser } from "@/server/auth/session";
import { activityDeps } from "@/server/services/activity-deps";
import { addActivity, deleteActivity, saveSteps, updateActivity, type Result } from "@/server/services/activity-service";
import { ACTIVITY_MESSAGES } from "./messages";

/*
 * Todas las escrituras de actividad pasan por acá: Server Actions que vuelven
 * a verificar la sesión y validan con Zod en el servidor (dentro del
 * servicio). El cliente nunca manda calorías: las calcula el servidor.
 */

function formToObject(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of formData) if (typeof v === "string" && !k.startsWith("$")) out[k] = v;
  return out;
}

async function run<T>(fn: (userId: string) => Promise<Result<T>>): Promise<Result<T> | FormState> {
  const user = await requireUser();
  try {
    return await fn(user.id);
  } catch {
    // El detalle ya quedó en el log (solo códigos de error).
    return { status: "error", message: ACTIVITY_MESSAGES.generic };
  }
}

const isFormState = (r: unknown): r is FormState => typeof r === "object" && r !== null && "status" in r;
const toError = (r: { code: keyof typeof ACTIVITY_MESSAGES; fieldErrors?: FormState["fieldErrors"] }): FormState => ({
  status: "error",
  message: ACTIVITY_MESSAGES[r.code],
  fieldErrors: r.fieldErrors,
});

function refresh() {
  revalidatePath("/actividad");
  revalidatePath("/");
}

export async function addActivityAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const r = await run(async (uid) => addActivity(await activityDeps(uid), uid, formToObject(formData)));
  if (isFormState(r)) return r;
  if (!r.ok) return toError(r);
  refresh();
  redirect(`/actividad?fecha=${r.value.date}`);
}

export async function updateActivityAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const r = await run(async (uid) => updateActivity(await activityDeps(uid), uid, formToObject(formData)));
  if (isFormState(r)) return r;
  if (!r.ok) return toError(r);
  refresh();
  redirect(`/actividad?fecha=${r.value.date}`);
}

export async function deleteActivityAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const r = await run(async (uid) => deleteActivity(await activityDeps(uid), uid, formData.get("entryId")));
  if (isFormState(r)) return r;
  if (!r.ok) return toError(r);
  refresh();
  redirect(`/actividad?fecha=${r.value.date}`);
}

export async function saveStepsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const r = await run(async (uid) => saveSteps(await activityDeps(uid), uid, formToObject(formData)));
  if (isFormState(r)) return r;
  if (!r.ok) return toError(r);
  refresh();
  return { status: "success", message: "Pasos guardados." };
}
