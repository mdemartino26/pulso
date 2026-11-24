import type { IsoDate } from "./types";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Convierte "YYYY-MM-DD" a sus partes, validando que la fecha exista. */
export function parseIsoDate(date: IsoDate): { year: number; month: number; day: number } {
  const match = ISO_DATE.exec(date);
  if (!match) throw new RangeError(`Fecha inválida: ${date}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    throw new RangeError(`Fecha inválida: ${date}`);
  }
  return { year, month, day };
}

/** Suma (o resta) días a una fecha local, sin pasar por zonas horarias. */
export function addDays(date: IsoDate, days: number): IsoDate {
  const { year, month, day } = parseIsoDate(date);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return d.toISOString().slice(0, 10);
}

/** Días entre dos fechas locales (b − a). */
export function daysBetween(a: IsoDate, b: IsoDate): number {
  const pa = parseIsoDate(a);
  const pb = parseIsoDate(b);
  return Math.round(
    (Date.UTC(pb.year, pb.month - 1, pb.day) - Date.UTC(pa.year, pa.month - 1, pa.day)) / 86_400_000,
  );
}

/**
 * El "día" de un instante en la zona horaria del usuario. Ej.: las 23:30
 * del 24/11 en Buenos Aires son las 02:30 UTC del 25/11, pero el registro
 * pertenece al 24/11.
 */
export function localDate(instant: Date, timeZone: string): IsoDate {
  // en-CA formatea como YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

export function isValidTimeZone(timeZone: string): boolean {
  if (!timeZone || timeZone.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Edad cumplida en una fecha dada (la edad "se calcula sola"). */
export function ageOn(birthDate: IsoDate, onDate: IsoDate): number {
  const b = parseIsoDate(birthDate);
  const o = parseIsoDate(onDate);
  let age = o.year - b.year;
  if (o.month < b.month || (o.month === b.month && o.day < b.day)) age -= 1;
  return age;
}
