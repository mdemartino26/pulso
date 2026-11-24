import { daysBetween } from "./dates";
import type { IsoDate } from "./types";

export interface DatedValue {
  date: IsoDate;
  value: number;
}

export interface TrendPoint extends DatedValue {
  /** Promedio de los registros de los últimos `windowDays` días (incluido éste). */
  average: number;
}

/**
 * Promedio móvil por días de calendario (no por cantidad de registros): si
 * faltan días, se promedian los que hay en la ventana. Es la "tendencia" que
 * se destaca en el gráfico de peso.
 */
export function movingAverage(points: readonly DatedValue[], windowDays = 7): TrendPoint[] {
  const sorted = [...points].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return sorted.map((point, i) => {
    let sum = 0;
    let count = 0;
    for (let j = i; j >= 0; j--) {
      const other = sorted[j];
      if (!other || daysBetween(other.date, point.date) >= windowDays) break;
      sum += other.value;
      count += 1;
    }
    return { ...point, average: Math.round((sum / count) * 100) / 100 };
  });
}
