import { addDays } from "./dates";
import type { IsoDate } from "./types";

export interface HabitWindow {
  /** Días cumplidos dentro de la ventana (incluye hoy). */
  done: number;
  /** Tamaño de la ventana (por defecto 7). */
  window: number;
  doneToday: boolean;
  /** Cumplido o no en cada día de la ventana, del más viejo a hoy. */
  days: { date: IsoDate; done: boolean }[];
}

/**
 * Racha "sin culpa": en vez de contar días seguidos (que se rompen con un
 * solo día malo), muestra cuántos de los últimos N días se cumplió.
 */
export function habitWindow(checkedDates: Iterable<IsoDate>, today: IsoDate, window = 7): HabitWindow {
  const set = new Set(checkedDates);
  const days = Array.from({ length: window }, (_, i) => {
    const date = addDays(today, i - window + 1);
    return { date, done: set.has(date) };
  });
  return { done: days.filter((d) => d.done).length, window, doneToday: set.has(today), days };
}
