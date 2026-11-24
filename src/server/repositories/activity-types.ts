import type { Intensity, IsoDate, MetRow } from "@/lib/calc";

export type ActivityCategory = "gym" | "cardio" | "sport" | "daily";

export interface MetActivity extends MetRow {
  id: number;
  slug: string;
  name: string;
  category: ActivityCategory;
}

export interface Exercise {
  id: number;
  slug: string;
  name: string;
  muscleGroup: string;
}

export interface StrengthSet {
  exerciseId: number;
  setNumber: number;
  reps: number;
  weightKg: number;
}

export interface ActivityEntry {
  id: string;
  date: IsoDate;
  metActivityId: number;
  intensity: Intensity;
  durationMin: number;
  metValue: number;
  kcal: number;
  stepsIncluded: number;
  sets: StrengthSet[];
}

export type NewActivityEntry = Omit<ActivityEntry, "id">;

export interface StrengthHistoryRow {
  date: IsoDate;
  entryId: string;
  setNumber: number;
  reps: number;
  weightKg: number;
}

/** Tablas de referencia (solo lectura). */
export interface ActivityCatalogRepository {
  activities(): Promise<MetActivity[]>;
  exercises(): Promise<Exercise[]>;
}

export interface ActivityEntryRepository {
  listByDate(userId: string, date: IsoDate): Promise<ActivityEntry[]>;
  get(userId: string, id: string): Promise<ActivityEntry | null>;
  insert(userId: string, entry: NewActivityEntry): Promise<string>;
  update(userId: string, id: string, entry: Omit<NewActivityEntry, "date">): Promise<boolean>;
  remove(userId: string, id: string): Promise<boolean>;
  /** Series de un ejercicio, de la más nueva a la más vieja. */
  strengthHistory(userId: string, exerciseId: number, limit: number): Promise<StrengthHistoryRow[]>;
  /** Ejercicios de fuerza que la persona registró alguna vez. */
  trainedExerciseIds(userId: string): Promise<number[]>;
}

export interface StepRepository {
  get(userId: string, date: IsoDate): Promise<number | null>;
  upsert(userId: string, date: IsoDate, steps: number): Promise<void>;
}
