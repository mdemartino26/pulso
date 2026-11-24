"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/features/auth/form-state";
import { requireUser } from "@/server/auth/session";
import { trackingDeps } from "@/server/services/tracking-deps";
import {
  addWater,
  archiveHabit,
  createHabit,
  deleteWeight,
  logWeight,
  renameHabit,
  saveWellbeing,
  toggleHabit,
  undoWater,
  type Result,
  type TrackingDeps,
} from "@/server/services/tracking-service";
import { TRACKING_MESSAGES } from "./messages";

/*
 * Escrituras de agua, peso, sueño, ánimo y hábitos: Server Actions que
 * vuelven a verificar la sesión y validan con Zod en el servidor (dentro
 * del servicio).
 */

function formToObject(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of formData) if (typeof v === "string" && !k.startsWith("$")) out[k] = v;
  return out;
}

type Fn<T> = (deps: TrackingDeps, userId: string, raw: unknown) => Promise<Result<T>>;

/** Corre la acción y la traduce a un estado de formulario sin detalles internos. */
function action<T>(fn: Fn<T>, paths: string[], success?: string) {
  return async (_prev: FormState, formData: FormData): Promise<FormState> => {
    const user = await requireUser();
    let r: Result<T>;
    try {
      r = await fn(await trackingDeps(user.id), user.id, formToObject(formData));
    } catch {
      // El detalle ya quedó en el log (solo códigos de error).
      return { status: "error", message: TRACKING_MESSAGES.generic };
    }
    if (!r.ok) return { status: "error", message: TRACKING_MESSAGES[r.code], fieldErrors: r.fieldErrors };
    for (const p of paths) revalidatePath(p);
    return success ? { status: "success", message: success } : { status: "success" };
  };
}

// Next exige que cada export de un archivo "use server" sea una función async.
const addWaterImpl = action(addWater, ["/"]);
const undoWaterImpl = action(undoWater, ["/"]);
const logWeightImpl = action(logWeight, ["/", "/peso", "/perfil"], "Peso guardado. Recalculamos tus metas.");
const deleteWeightImpl = action(deleteWeight, ["/", "/peso", "/perfil"], "Registro borrado.");
const saveWellbeingImpl = action(saveWellbeing, ["/", "/bienestar"], "Guardado.");
const createHabitImpl = action(createHabit, ["/", "/habitos"], "Hábito agregado.");
const renameHabitImpl = action(renameHabit, ["/", "/habitos"], "Nombre actualizado.");
const archiveHabitImpl = action(archiveHabit, ["/", "/habitos"], "Hábito archivado.");
const toggleHabitImpl = action(toggleHabit, ["/", "/habitos"]);

export async function addWaterAction(prev: FormState, fd: FormData) {
  return addWaterImpl(prev, fd);
}
export async function undoWaterAction(prev: FormState, fd: FormData) {
  return undoWaterImpl(prev, fd);
}
export async function logWeightAction(prev: FormState, fd: FormData) {
  return logWeightImpl(prev, fd);
}
export async function deleteWeightAction(prev: FormState, fd: FormData) {
  return deleteWeightImpl(prev, fd);
}
export async function saveWellbeingAction(prev: FormState, fd: FormData) {
  return saveWellbeingImpl(prev, fd);
}
export async function createHabitAction(prev: FormState, fd: FormData) {
  return createHabitImpl(prev, fd);
}
export async function renameHabitAction(prev: FormState, fd: FormData) {
  return renameHabitImpl(prev, fd);
}
export async function archiveHabitAction(prev: FormState, fd: FormData) {
  return archiveHabitImpl(prev, fd);
}
export async function toggleHabitAction(prev: FormState, fd: FormData) {
  return toggleHabitImpl(prev, fd);
}
