/**
 * Tipos de las tablas de Supabase que usa la app.
 *
 * Escritos a mano a partir de supabase/migrations/. Cuando tengas el
 * proyecto creado podés regenerarlos con:
 *   npx supabase gen types typescript --project-id <id> > src/server/db/database.types.ts
 * Se van sumando tablas a medida que las etapas las usan.
 */

export type BiologicalSex = "female" | "male";
export type ActivityLevelDb = "sedentary" | "light" | "moderate" | "high";
export type GoalTypeDb = "lose" | "maintain" | "gain";
export type TargetSource = "formula" | "adaptive";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          sex: BiologicalSex | null;
          birth_date: string | null;
          height_cm: number | null;
          activity_level: ActivityLevelDb | null;
          timezone: string;
          goal: GoalTypeDb | null;
          weekly_rate_kg: number | null;
          water_goal_ml_override: number | null;
          onboarding_completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: {
          sex?: BiologicalSex | null;
          birth_date?: string | null;
          height_cm?: number | null;
          activity_level?: ActivityLevelDb | null;
          timezone?: string;
          goal?: GoalTypeDb | null;
          weekly_rate_kg?: number | null;
          water_goal_ml_override?: number | null;
          onboarding_completed_at?: string | null;
        };
        Relationships: [];
      };
      weight_entries: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          weight_kg: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id?: string;
          date: string;
          weight_kg: number;
        };
        Update: {
          weight_kg?: number;
        };
        Relationships: [];
      };
      daily_targets: {
        Row: {
          user_id: string;
          date: string;
          bmr_kcal: number;
          tdee_kcal: number;
          kcal_target: number;
          protein_min_g: number;
          protein_max_g: number;
          water_ml: number;
          source: TargetSource;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id?: string;
          date: string;
          bmr_kcal: number;
          tdee_kcal: number;
          kcal_target: number;
          protein_min_g: number;
          protein_max_g: number;
          water_ml: number;
          source?: TargetSource;
        };
        Update: {
          bmr_kcal?: number;
          tdee_kcal?: number;
          kcal_target?: number;
          protein_min_g?: number;
          protein_max_g?: number;
          water_ml?: number;
          source?: TargetSource;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: {
      biological_sex: BiologicalSex;
      activity_level: ActivityLevelDb;
      goal_type: GoalTypeDb;
      target_source: TargetSource;
    };
    CompositeTypes: { [_ in never]: never };
  };
}
