"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/features/auth/form-state";
import { requireUser } from "@/server/auth/session";
import { foodDeps } from "@/server/services/food-deps";
import {
  addEntry,
  copyDay,
  createCustomFood,
  deleteCustomFood,
  deleteEntry,
  setFavorite,
  updateCustomFood,
  updateEntry,
  type Result,
} from "@/server/services/food-service";
import { FOOD_MESSAGES } from "./messages";

/*
 * Todas las escrituras de comidas pasan por acá: Server Actions que vuelven
 * a verificar la sesión y validan con Zod en el servidor (dentro del
 * servicio). Next además rechaza pedidos de otros orígenes (CSRF).
 */

function formToObject(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of formData) if (typeof v === "string" && !k.startsWith("$")) out[k] = v;
  return out;
}

function toFormState<T>(result: Result<T>): FormState | null {
  if (result.ok) return null;
  return { status: "error", message: FOOD_MESSAGES[result.code], fieldErrors: result.fieldErrors };
}

async function run<T>(fn: (userId: string) => Promise<Result<T>>): Promise<Result<T> | FormState> {
  const user = await requireUser();
  try {
    return await fn(user.id);
  } catch {
    // El detalle ya quedó en el log (solo códigos de error).
    return { status: "error", message: FOOD_MESSAGES.generic };
  }
}

const isFormState = (r: unknown): r is FormState => typeof r === "object" && r !== null && "status" in r;
const dayUrl = (date: string) => `/comidas?fecha=${date}`;

export async function addFoodEntryAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const r = await run(async (uid) => addEntry(await foodDeps(uid), uid, formToObject(formData)));
  if (isFormState(r)) return r;
  if (!r.ok) return toFormState(r)!;
  revalidatePath("/comidas");
  redirect(dayUrl(r.value.date));
}

export async function updateFoodEntryAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const r = await run(async (uid) => updateEntry(await foodDeps(uid), uid, formToObject(formData)));
  if (isFormState(r)) return r;
  if (!r.ok) return toFormState(r)!;
  revalidatePath("/comidas");
  redirect(dayUrl(r.value.date));
}

export async function deleteFoodEntryAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const r = await run(async (uid) => deleteEntry(await foodDeps(uid), uid, formData.get("entryId")));
  if (isFormState(r)) return r;
  if (!r.ok) return toFormState(r)!;
  revalidatePath("/comidas");
  redirect(dayUrl(r.value.date));
}

export async function copyDayAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const input = formToObject(formData);
  const r = await run(async (uid) => copyDay(await foodDeps(uid), uid, input));
  if (isFormState(r)) return r;
  if (!r.ok) return toFormState(r)!;
  revalidatePath("/comidas");
  const n = r.value.copied;
  return { status: "success", message: n === 1 ? "Copiamos 1 alimento." : `Copiamos ${n} alimentos.` };
}

export async function setFavoriteAction(ref: { source: string; id: string }, on: boolean): Promise<{ ok: boolean }> {
  const r = await run(async (uid) => setFavorite(await foodDeps(uid), uid, ref, on));
  return { ok: !isFormState(r) && r.ok };
}

export async function createCustomFoodAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const r = await run(async (uid) => createCustomFood(await foodDeps(uid), uid, formToObject(formData)));
  if (isFormState(r)) return r;
  if (!r.ok) return toFormState(r)!;
  revalidatePath("/comidas");
  // Si veníamos de "agregar comida", volvemos ahí con el alimento elegido.
  const back = formData.get("returnTo");
  if (typeof back === "string" && /^\/comidas\/agregar\?fecha=\d{4}-\d{2}-\d{2}&comida=[a-z_]+$/.test(back)) {
    redirect(`${back}&alimento=custom:${r.value.ref.id}`);
  }
  redirect("/comidas/alimentos");
}

export async function updateCustomFoodAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const r = await run(async (uid) => updateCustomFood(await foodDeps(uid), uid, formData.get("id"), formToObject(formData)));
  if (isFormState(r)) return r;
  if (!r.ok) return toFormState(r)!;
  revalidatePath("/comidas");
  redirect("/comidas/alimentos");
}

export async function deleteCustomFoodAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const r = await run(async (uid) => deleteCustomFood(await foodDeps(uid), uid, formData.get("id")));
  if (isFormState(r)) return r;
  if (!r.ok) return toFormState(r)!;
  revalidatePath("/comidas");
  redirect("/comidas/alimentos");
}
