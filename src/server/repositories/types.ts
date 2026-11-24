import type { ActivityLevel, DailyTargets, Goal, IsoDate, Sex } from "@/lib/calc";

/**
 * Contratos de la capa de datos. Los servicios dependen de estas interfaces,
 * no de Supabase: así se pueden testear con implementaciones en memoria y
 * cambiar de proveedor sin tocar la lógica.
 */

export interface ProfileRecord {
  id: string;
  sex: Sex | null;
  birthDate: IsoDate | null;
  heightCm: number | null;
  activityLevel: ActivityLevel | null;
  timezone: string;
  goal: Goal | null;
  weeklyRateKg: number | null;
  waterGoalOverrideMl: number | null;
  onboardingCompletedAt: string | null;
}

/** Perfil con todos los datos de la fórmula (onboarding completo). */
export type CompleteProfile = ProfileRecord & {
  sex: Sex;
  birthDate: IsoDate;
  heightCm: number;
  activityLevel: ActivityLevel;
  goal: Goal;
  weeklyRateKg: number;
};

export function isCompleteProfile(p: ProfileRecord | null): p is CompleteProfile {
  return (
    p !== null &&
    p.onboardingCompletedAt !== null &&
    p.sex !== null &&
    p.birthDate !== null &&
    p.heightCm !== null &&
    p.activityLevel !== null &&
    p.goal !== null &&
    p.weeklyRateKg !== null
  );
}

export type ProfileUpdate = Partial<Omit<ProfileRecord, "id">>;

export interface WeightRecord {
  date: IsoDate;
  weightKg: number;
}

export interface ProfileRepository {
  get(userId: string): Promise<ProfileRecord | null>;
  update(userId: string, patch: ProfileUpdate): Promise<void>;
}

export interface WeightRepository {
  /** Último peso registrado en esa fecha o antes. */
  latestOnOrBefore(userId: string, date: IsoDate): Promise<WeightRecord | null>;
  upsert(userId: string, date: IsoDate, weightKg: number): Promise<void>;
}

export interface DailyTargetsRepository {
  get(userId: string, date: IsoDate): Promise<DailyTargets | null>;
  upsert(userId: string, date: IsoDate, targets: DailyTargets): Promise<void>;
}

/** Error de acceso a datos. El mensaje es genérico; el detalle va solo al log. */
/** Pistas solo en desarrollo, para los errores de configuración más comunes. */
const DEV_HINTS: Record<string, string> = {
  PGRST205:
    "La tabla no existe en tu Supabase: aplicá las migraciones de supabase/migrations (ver el doc \"cómo correr la app\").",
  PGRST202: "Falta una función de la base: aplicá las migraciones de supabase/migrations.",
  "42P01": "La tabla no existe: aplicá las migraciones de supabase/migrations.",
  "42501": "Permiso denegado: revisá que se haya aplicado la migración de RLS y permisos.",
  profile_row_missing:
    "Tu usuario no tiene fila en profiles (se creó antes de aplicar las migraciones). Ver \"Problemas comunes\" en el doc.",
};

export class RepositoryError extends Error {
  constructor(operation: string, cause?: { code?: string; message?: string }) {
    super(`No se pudo completar la operación de datos (${operation})`);
    this.name = "RepositoryError";
    const cacheTable = operation.startsWith("foods_cache") || operation.startsWith("food_search_cache");
    const hint =
      process.env.NODE_ENV === "development" && cause?.code
        ? cacheTable && cause.code === "42501"
          ? "La clave secreta no tiene permiso sobre la caché: aplicá la migración 20261124190000_permisos_cache_servidor.sql y revisá que SUPABASE_SECRET_KEY empiece con sb_secret_."
          : DEV_HINTS[cause.code]
        : undefined;
    console.error(`[repo] ${operation} falló`, { code: cause?.code }, hint ? `\n→ ${hint}` : "");
  }
}
