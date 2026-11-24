import "server-only";
import { createHabitRepository, createWeightHistoryRepository, createWellbeingRepository } from "@/server/repositories/tracking-repositories";
import { createTrendsRepository } from "@/server/repositories/trends-repositories";
import { createSupabaseServerClient } from "@/server/supabase/server";
import type { TrendsDeps } from "./trends-service";

/** Dependencias reales de tendencias. `today` viene del perfil ya cargado por la página. */
export async function trendsDeps(today: string): Promise<TrendsDeps> {
  const db = await createSupabaseServerClient();
  return {
    trends: createTrendsRepository(db),
    weightHistory: createWeightHistoryRepository(db),
    wellbeing: createWellbeingRepository(db),
    habits: createHabitRepository(db),
    today: async () => today,
  };
}
