import { addDays, parseIsoDate, type IsoDate } from "@/lib/calc";

/** Fecha pedida por URL, validada: si es inválida o futura, hoy. */
export function pickDate(raw: string | string[] | undefined, today: IsoDate): IsoDate {
  if (typeof raw !== "string") return today;
  try {
    parseIsoDate(raw);
  } catch {
    return today;
  }
  return raw > today || raw < addDays(today, -366) ? today : raw;
}

export function dayLabel(date: IsoDate, today: IsoDate): string {
  if (date === today) return "Hoy";
  if (date === addDays(today, -1)) return "Ayer";
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}
