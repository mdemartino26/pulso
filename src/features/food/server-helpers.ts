import "server-only";
import { mealForHour, MEALS, type Meal } from "@/lib/food";

/** Comida pedida por URL o, si no viene, la que corresponde a la hora local. */
export function pickMeal(raw: string | string[] | undefined, timezone: string, now = new Date()): Meal {
  if (typeof raw === "string" && (MEALS as readonly string[]).includes(raw)) return raw as Meal;
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: timezone }).format(now),
  );
  return mealForHour(Number.isFinite(hour) ? hour : 12);
}

/** "custom:<uuid>" u "off:<uuid>" → referencia (o null si no tiene ese formato). */
export function parseRefParam(raw: string | string[] | undefined) {
  if (typeof raw !== "string") return null;
  const m = /^(usda|off|custom):([0-9a-f-]{36})$/i.exec(raw);
  return m ? { source: m[1] as "usda" | "off" | "custom", id: m[2]! } : null;
}
