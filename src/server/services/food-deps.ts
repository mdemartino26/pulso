import "server-only";
import { getServerEnv } from "@/lib/env.server";
import { createOpenFoodFactsProvider } from "@/server/food/providers/open-food-facts";
import { createUsdaProvider } from "@/server/food/providers/usda";
import { createFoodCacheWriter } from "@/server/repositories/food-cache-writer";
import {
  createCustomFoodRepository,
  createFavoriteRepository,
  createFoodCatalogRepository,
  createFoodEntryRepository,
  createRateLimiter,
} from "@/server/repositories/food-repositories";
import { createProfileRepository } from "@/server/repositories/supabase-repositories";
import { createSupabaseServerClient } from "@/server/supabase/server";
import type { FoodDeps } from "./food-service";
import { todayFor } from "./profile-service";

/** User-Agent genérico: Open Food Facts pide identificar la app, sin datos personales. */
const USER_AGENT = "Pulso/0.1 (app de seguimiento de habitos)";

/** Arma las dependencias reales del servicio de comidas para el usuario actual. */
export async function foodDeps(userId: string): Promise<FoodDeps> {
  const db = await createSupabaseServerClient();
  const profiles = createProfileRepository(db);
  const now = () => new Date();
  let writer: ReturnType<typeof createFoodCacheWriter> | null = null;

  return {
    catalog: createFoodCatalogRepository(db),
    cacheWriter: () => (writer ??= createFoodCacheWriter()),
    customFoods: createCustomFoodRepository(db),
    entries: createFoodEntryRepository(db),
    favorites: createFavoriteRepository(db),
    rateLimiter: createRateLimiter(db),
    // Se crean recién cuando se usan, así las páginas que no buscan no
    // necesitan las claves del servidor.
    get providers() {
      const env = getServerEnv();
      return [
        createOpenFoodFactsProvider({ userAgent: USER_AGENT, baseUrl: env.OFF_API_BASE_URL }),
        createUsdaProvider({ apiKey: env.USDA_API_KEY, baseUrl: env.USDA_API_BASE_URL }),
      ];
    },
    today: async () => {
      const profile = await profiles.get(userId);
      return todayFor({ now }, profile?.timezone ?? "");
    },
    now,
  };
}
