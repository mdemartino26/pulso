import type { IsoDate } from "@/lib/calc";

/** Filas mínimas por día para armar tendencias. Todo entre `from` y `to`, incluidos. */
export interface TrendsRepository {
  foodTotals(userId: string, from: IsoDate, to: IsoDate): Promise<{ date: IsoDate; kcal: number; protein: number }[]>;
  targets(userId: string, from: IsoDate, to: IsoDate): Promise<{ date: IsoDate; kcalTarget: number; proteinMinG: number; proteinMaxG: number; waterMl: number }[]>;
  activity(userId: string, from: IsoDate, to: IsoDate): Promise<{ date: IsoDate; kcal: number; minutes: number }[]>;
  steps(userId: string, from: IsoDate, to: IsoDate): Promise<{ date: IsoDate; steps: number }[]>;
  water(userId: string, from: IsoDate, to: IsoDate): Promise<{ date: IsoDate; ml: number }[]>;
}
