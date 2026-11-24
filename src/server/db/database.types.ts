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
export type FoodSourceDb = "usda" | "off" | "custom";
export type NutrientBasisDb = "g" | "ml";
export type ServingUnitDb = "g" | "ml" | "unit" | "serving";
export type IntensityDb = "low" | "moderate" | "high";
export type ActivityCategoryDb = "gym" | "cardio" | "sport" | "daily";
export type MealTypeDb = "breakfast" | "lunch" | "afternoon_snack" | "dinner" | "snack";

/** Columnas de nutrientes cada 100 (comunes a varias tablas). */
type Per100Columns = {
  basis: NutrientBasisDb;
  kcal_100: number;
  protein_100: number;
  carbs_100: number;
  fat_100: number;
  fiber_100: number | null;
  sugars_100: number | null;
  sodium_mg_100: number | null;
};
type Per100Insert = Omit<Per100Columns, "basis" | "fiber_100" | "sugars_100" | "sodium_mg_100"> &
  Partial<Pick<Per100Columns, "basis" | "fiber_100" | "sugars_100" | "sodium_mg_100">>;

type FoodsCacheRow = Per100Columns & {
  id: string;
  source: Exclude<FoodSourceDb, "custom">;
  source_id: string;
  barcode: string | null;
  name: string;
  brand: string | null;
  serving_size: number | null;
  serving_label: string | null;
  image_url: string | null;
  fetched_at: string;
};

type CustomFoodsRow = Per100Columns & {
  id: string;
  user_id: string;
  name: string;
  brand: string | null;
  serving_size: number | null;
  serving_label: string | null;
  created_at: string;
  updated_at: string;
};

type FoodEntriesRow = Per100Columns & {
  id: string;
  user_id: string;
  date: string;
  meal: MealTypeDb;
  source: FoodSourceDb;
  food_cache_id: string | null;
  custom_food_id: string | null;
  name: string;
  brand: string | null;
  quantity: number;
  unit: ServingUnitDb;
  base_per_unit: number;
  amount: number;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  sugars_g: number | null;
  sodium_mg: number | null;
  created_at: string;
  updated_at: string;
};

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
      foods_cache: {
        Row: FoodsCacheRow;
        Insert: Per100Insert & {
          source: Exclude<FoodSourceDb, "custom">;
          source_id: string;
          barcode?: string | null;
          name: string;
          brand?: string | null;
          serving_size?: number | null;
          serving_label?: string | null;
          image_url?: string | null;
          fetched_at?: string;
        };
        Update: Partial<FoodsCacheRow>;
        Relationships: [];
      };
      food_search_cache: {
        Row: { provider: Exclude<FoodSourceDb, "custom">; query_norm: string; food_ids: string[]; fetched_at: string };
        Insert: { provider: Exclude<FoodSourceDb, "custom">; query_norm: string; food_ids: string[]; fetched_at?: string };
        Update: { food_ids?: string[]; fetched_at?: string };
        Relationships: [];
      };
      custom_foods: {
        Row: CustomFoodsRow;
        Insert: Per100Insert & {
          user_id?: string;
          name: string;
          brand?: string | null;
          serving_size?: number | null;
          serving_label?: string | null;
        };
        Update: Partial<Omit<CustomFoodsRow, "id" | "user_id" | "created_at" | "updated_at">>;
        Relationships: [];
      };
      food_entries: {
        Row: FoodEntriesRow;
        Insert: Per100Insert & {
          user_id?: string;
          date: string;
          meal: MealTypeDb;
          source: FoodSourceDb;
          food_cache_id?: string | null;
          custom_food_id?: string | null;
          name: string;
          brand?: string | null;
          quantity: number;
          unit: ServingUnitDb;
          base_per_unit: number;
        };
        Update: { meal?: MealTypeDb; quantity?: number; unit?: ServingUnitDb; base_per_unit?: number };
        Relationships: [];
      };
      favorite_foods: {
        Row: { id: string; user_id: string; food_cache_id: string | null; custom_food_id: string | null; created_at: string };
        Insert: { user_id?: string; food_cache_id?: string | null; custom_food_id?: string | null };
        Update: { [_ in never]: never };
        Relationships: [];
      };
      met_activities: {
        Row: {
          id: number;
          slug: string;
          name_es: string;
          category: ActivityCategoryDb;
          met_low: number;
          met_moderate: number;
          met_high: number;
          is_ambulatory: boolean;
        };
        Insert: { [_ in never]: never };
        Update: { [_ in never]: never };
        Relationships: [];
      };
      exercises: {
        Row: { id: number; slug: string; name_es: string; muscle_group: string };
        Insert: { [_ in never]: never };
        Update: { [_ in never]: never };
        Relationships: [];
      };
      activity_entries: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          met_activity_id: number;
          intensity: IntensityDb;
          duration_min: number;
          met_value: number;
          kcal: number;
          steps_included: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id?: string;
          date: string;
          met_activity_id: number;
          intensity: IntensityDb;
          duration_min: number;
          met_value: number;
          kcal: number;
          steps_included?: number;
        };
        Update: {
          met_activity_id?: number;
          intensity?: IntensityDb;
          duration_min?: number;
          met_value?: number;
          kcal?: number;
          steps_included?: number;
        };
        Relationships: [];
      };
      strength_sets: {
        Row: {
          id: string;
          user_id: string;
          activity_entry_id: string;
          exercise_id: number;
          set_number: number;
          reps: number;
          weight_kg: number;
          created_at: string;
        };
        Insert: {
          user_id?: string;
          activity_entry_id: string;
          exercise_id: number;
          set_number: number;
          reps: number;
          weight_kg?: number;
        };
        Update: { [_ in never]: never };
        Relationships: [];
      };
      step_entries: {
        Row: { id: string; user_id: string; date: string; steps: number; created_at: string; updated_at: string };
        Insert: { user_id?: string; date: string; steps: number };
        Update: { steps?: number };
        Relationships: [];
      };
      water_entries: {
        Row: { id: string; user_id: string; date: string; amount_ml: number; created_at: string };
        Insert: { user_id?: string; date: string; amount_ml: number };
        Update: { [_ in never]: never };
        Relationships: [];
      };
      wellbeing_entries: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          sleep_hours: number | string | null;
          mood: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: { user_id?: string; date: string; sleep_hours?: number | null; mood?: number | null };
        Update: { sleep_hours?: number | null; mood?: number | null };
        Relationships: [];
      };
      habits: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          sort_order: number;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: { user_id?: string; name: string; sort_order?: number };
        Update: { name?: string; sort_order?: number; archived_at?: string | null };
        Relationships: [];
      };
      habit_checks: {
        Row: { habit_id: string; user_id: string; date: string; created_at: string };
        Insert: { habit_id: string; user_id?: string; date: string };
        Update: { [_ in never]: never };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      consume_rate_limit: {
        Args: { p_bucket: string; p_max: number; p_window_seconds: number };
        Returns: boolean;
      };
    };
    Enums: {
      biological_sex: BiologicalSex;
      activity_level: ActivityLevelDb;
      goal_type: GoalTypeDb;
      target_source: TargetSource;
      food_source: FoodSourceDb;
      nutrient_basis: NutrientBasisDb;
      serving_unit: ServingUnitDb;
      meal_type: MealTypeDb;
      intensity: IntensityDb;
      activity_category: ActivityCategoryDb;
    };
    CompositeTypes: { [_ in never]: never };
  };
}
