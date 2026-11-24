import "server-only";
import type { ProviderFood } from "@/lib/food";
import type { Database } from "@/server/db/database.types";
import { createAdminClient } from "@/server/supabase/admin";
import { rowToCachedFood, FOODS_CACHE_COLUMNS } from "./food-mappers";
import type { FoodCacheWriter } from "./food-types";
import { RepositoryError } from "./types";

/**
 * Escritura de la caché compartida con la clave secreta.
 * Solo recibe alimentos que ya pasaron por la validación de los proveedores
 * (src/server/food/providers/sanitize.ts).
 */
export function createFoodCacheWriter(): FoodCacheWriter {
  const db = createAdminClient();
  return {
    async upsertFoods(foods: ProviderFood[]) {
      if (foods.length === 0) return [];
      const rows: Database["public"]["Tables"]["foods_cache"]["Insert"][] = foods.map((f) => ({
        source: f.source,
        source_id: f.sourceId,
        barcode: f.barcode,
        name: f.name,
        brand: f.brand,
        basis: f.basis,
        kcal_100: f.per100.kcal,
        protein_100: f.per100.protein,
        carbs_100: f.per100.carbs,
        fat_100: f.per100.fat,
        fiber_100: f.per100.fiber,
        sugars_100: f.per100.sugars,
        sodium_mg_100: f.per100.sodiumMg,
        serving_size: f.serving?.size ?? null,
        serving_label: f.serving?.label ?? null,
        image_url: f.imageUrl,
        fetched_at: new Date().toISOString(),
      }));
      // Un mismo producto puede venir dos veces en una respuesta: deduplicar.
      const unique = [...new Map(rows.map((r) => [`${r.source}:${r.source_id}`, r])).values()];
      const { data, error } = await db
        .from("foods_cache")
        .upsert(unique, { onConflict: "source,source_id" })
        .select(FOODS_CACHE_COLUMNS);
      if (error) throw new RepositoryError("foods_cache.upsert", error);
      return data.map(rowToCachedFood);
    },

    async getSearch(provider, queryNorm) {
      const { data, error } = await db
        .from("food_search_cache")
        .select("food_ids, fetched_at")
        .eq("provider", provider)
        .eq("query_norm", queryNorm)
        .maybeSingle();
      if (error) throw new RepositoryError("food_search_cache.get", error);
      return data ? { foodIds: data.food_ids, fetchedAt: data.fetched_at } : null;
    },

    async saveSearch(provider, queryNorm, foodIds) {
      const { error } = await db.from("food_search_cache").upsert(
        { provider, query_norm: queryNorm, food_ids: foodIds.slice(0, 50), fetched_at: new Date().toISOString() },
        { onConflict: "provider,query_norm" },
      );
      if (error) throw new RepositoryError("food_search_cache.save", error);
    },
  };
}
