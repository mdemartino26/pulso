import type { IsoDate } from "@/lib/calc";
import type { WeightRecord } from "./types";

export interface WaterRepository {
  /** Total de ml del día. */
  total(userId: string, date: IsoDate): Promise<number>;
  add(userId: string, date: IsoDate, amountMl: number): Promise<void>;
  /** Borra el último registro del día (deshacer). Devuelve false si no había. */
  removeLast(userId: string, date: IsoDate): Promise<boolean>;
}

export interface WeightHistoryRepository {
  /** Pesos entre dos fechas (incluidas), del más viejo al más nuevo. */
  list(userId: string, from: IsoDate, to: IsoDate): Promise<WeightRecord[]>;
  remove(userId: string, date: IsoDate): Promise<boolean>;
  count(userId: string): Promise<number>;
}

export interface Wellbeing {
  date: IsoDate;
  sleepHours: number | null;
  mood: number | null;
}

export interface WellbeingRepository {
  get(userId: string, date: IsoDate): Promise<Wellbeing | null>;
  list(userId: string, from: IsoDate, to: IsoDate): Promise<Wellbeing[]>;
  upsert(userId: string, entry: Wellbeing): Promise<void>;
}

export interface Habit {
  id: string;
  name: string;
  sortOrder: number;
}

export interface HabitRepository {
  /** Hábitos activos (no archivados), en orden. */
  list(userId: string): Promise<Habit[]>;
  create(userId: string, name: string, sortOrder: number): Promise<string>;
  rename(userId: string, habitId: string, name: string): Promise<boolean>;
  archive(userId: string, habitId: string): Promise<boolean>;
  /** Checks entre dos fechas, de todos los hábitos. */
  checks(userId: string, from: IsoDate, to: IsoDate): Promise<{ habitId: string; date: IsoDate }[]>;
  setCheck(userId: string, habitId: string, date: IsoDate, done: boolean): Promise<void>;
}
