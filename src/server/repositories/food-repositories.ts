import "server-only";
import type { FoodRef } from "@/lib/food";
import type { ServerSupabaseClient } from "@/server/supabase/server";
import {
  CUSTOM_FOOD_COLUMNS,
  FOODS_CACHE_COLUMNS,
  FOOD_ENTRY_COLUMNS,
  customFoodToRow,
  per100ToRow,
  rowToCachedFood,
  rowToCustomFood,
  rowToFoodEntry,
} from "./food-mappers";
import type {
  FavoriteRepository,
  FoodCatalogRepository,
  FoodEntryRepository,
  CustomFoodRepository,
  RateLimiter,
} from "./food-types";
import { RepositoryError } from "./types";

/*
 * Repositorios de comidas con el cliente del usuario: RLS garantiza que
 * cada uno vea y toque solo lo suyo. Además filtramos por user_id.
 * Nada de SQL armado con strings: todo pasa por el query builder, que
 * manda los valores como parámetros.
 */

/** Escapa los comodines de LIKE para que la búsqueda sea literal. */
function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export function createFoodCatalogRepository(db: ServerSupabaseClient): FoodCatalogRepository {
  return {
    async getMany(ids) {
      if (ids.length === 0) return [];
      const { data, error } = await db.from("foods_cache").select(FOODS_CACHE_COLUMNS).in("id", ids);
      if (error) throw new RepositoryError("foods_cache.getMany", error);
      const byId = new Map(data.map((r) => [r.id, rowToCachedFood(r)]));
      return ids.flatMap((id) => byId.get(id) ?? []);
    },
    async findByBarcode(barcode) {
      const { data, error } = await db
        .from("foods_cache")
        .select(FOODS_CACHE_COLUMNS)
        .eq("barcode", barcode)
        .order("fetched_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new RepositoryError("foods_cache.findByBarcode", error);
      return data ? rowToCachedFood(data) : null;
    },
    async searchByName(query, limit) {
      const { data, error } = await db
        .from("foods_cache")
        .select(FOODS_CACHE_COLUMNS)
        .ilike("name", likePattern(query))
        .limit(limit);
      if (error) throw new RepositoryError("foods_cache.searchByName", error);
      return data.map(rowToCachedFood);
    },
  };
}

export function createCustomFoodRepository(db: ServerSupabaseClient): CustomFoodRepository {
  return {
    async list(userId) {
      const { data, error } = await db
        .from("custom_foods")
        .select(CUSTOM_FOOD_COLUMNS)
        .eq("user_id", userId)
        .order("name");
      if (error) throw new RepositoryError("custom_foods.list", error);
      return data.map(rowToCustomFood);
    },
    async getMany(userId, ids) {
      if (ids.length === 0) return [];
      const { data, error } = await db
        .from("custom_foods")
        .select(CUSTOM_FOOD_COLUMNS)
        .eq("user_id", userId)
        .in("id", ids);
      if (error) throw new RepositoryError("custom_foods.getMany", error);
      const byId = new Map(data.map((r) => [r.id, rowToCustomFood(r)]));
      return ids.flatMap((id) => byId.get(id) ?? []);
    },
    async search(userId, query, limit) {
      const { data, error } = await db
        .from("custom_foods")
        .select(CUSTOM_FOOD_COLUMNS)
        .eq("user_id", userId)
        .ilike("name", likePattern(query))
        .limit(limit);
      if (error) throw new RepositoryError("custom_foods.search", error);
      return data.map(rowToCustomFood);
    },
    async create(userId, d) {
      const { data, error } = await db
        .from("custom_foods")
        .insert({ user_id: userId, ...customFoodToRow(d) })
        .select(CUSTOM_FOOD_COLUMNS)
        .single();
      if (error) throw new RepositoryError("custom_foods.create", error);
      return rowToCustomFood(data);
    },
    async update(userId, id, d) {
      const { data, error } = await db
        .from("custom_foods")
        .update(customFoodToRow(d))
        .eq("user_id", userId)
        .eq("id", id)
        .select("id");
      if (error) throw new RepositoryError("custom_foods.update", error);
      return data.length > 0;
    },
    async remove(userId, id) {
      const { data, error } = await db.from("custom_foods").delete().eq("user_id", userId).eq("id", id).select("id");
      if (error) throw new RepositoryError("custom_foods.remove", error);
      return data.length > 0;
    },
  };
}

export function createFoodEntryRepository(db: ServerSupabaseClient): FoodEntryRepository {
  return {
    async listByDate(userId, date) {
      const { data, error } = await db
        .from("food_entries")
        .select(FOOD_ENTRY_COLUMNS)
        .eq("user_id", userId)
        .eq("date", date)
        .order("created_at");
      if (error) throw new RepositoryError("food_entries.listByDate", error);
      return data.map(rowToFoodEntry);
    },
    async get(userId, id) {
      const { data, error } = await db
        .from("food_entries")
        .select(FOOD_ENTRY_COLUMNS)
        .eq("user_id", userId)
        .eq("id", id)
        .maybeSingle();
      if (error) throw new RepositoryError("food_entries.get", error);
      return data ? rowToFoodEntry(data) : null;
    },
    async insert(userId, entries) {
      if (entries.length === 0) return;
      const rows = entries.map((e) => ({
        user_id: userId,
        date: e.date,
        meal: e.meal,
        source: e.ref?.source ?? ("custom" as const),
        food_cache_id: e.ref && e.ref.source !== "custom" ? e.ref.id : null,
        custom_food_id: e.ref && e.ref.source === "custom" ? e.ref.id : null,
        name: e.name,
        brand: e.brand,
        basis: e.basis,
        quantity: e.quantity,
        unit: e.unit,
        base_per_unit: e.basePerUnit,
        ...per100ToRow(e.per100),
      }));
      const { error } = await db.from("food_entries").insert(rows);
      if (error) throw new RepositoryError("food_entries.insert", error);
    },
    async update(userId, id, p) {
      const { data, error } = await db
        .from("food_entries")
        .update({ meal: p.meal, quantity: p.quantity, unit: p.unit, base_per_unit: p.basePerUnit })
        .eq("user_id", userId)
        .eq("id", id)
        .select("id");
      if (error) throw new RepositoryError("food_entries.update", error);
      return data.length > 0;
    },
    async remove(userId, id) {
      const { data, error } = await db.from("food_entries").delete().eq("user_id", userId).eq("id", id).select("id");
      if (error) throw new RepositoryError("food_entries.remove", error);
      return data.length > 0;
    },
    async recent(userId, limit) {
      const { data, error } = await db
        .from("food_entries")
        .select(FOOD_ENTRY_COLUMNS)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw new RepositoryError("food_entries.recent", error);
      return data.map(rowToFoodEntry);
    },
  };
}

export function createFavoriteRepository(db: ServerSupabaseClient): FavoriteRepository {
  const column = (ref: FoodRef) => (ref.source === "custom" ? "custom_food_id" : "food_cache_id");
  return {
    async list(userId) {
      const { data, error } = await db
        .from("favorite_foods")
        .select("food_cache_id, custom_food_id, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw new RepositoryError("favorite_foods.list", error);
      return data.flatMap((r): FoodRef[] =>
        r.custom_food_id
          ? [{ source: "custom", id: r.custom_food_id }]
          : r.food_cache_id
            ? [{ source: "usda", id: r.food_cache_id }] // la fuente real sale de la caché
            : [],
      );
    },
    async add(userId, ref) {
      const { error } = await db
        .from("favorite_foods")
        .upsert(
          ref.source === "custom"
            ? { user_id: userId, custom_food_id: ref.id }
            : { user_id: userId, food_cache_id: ref.id },
          { onConflict: `user_id,${column(ref)}`, ignoreDuplicates: true },
        );
      if (error) throw new RepositoryError("favorite_foods.add", error);
    },
    async remove(userId, ref) {
      const { error } = await db.from("favorite_foods").delete().eq("user_id", userId).eq(column(ref), ref.id);
      if (error) throw new RepositoryError("favorite_foods.remove", error);
    },
  };
}

export function createRateLimiter(db: ServerSupabaseClient): RateLimiter {
  return {
    async consume(bucket, max, windowSeconds) {
      const { data, error } = await db.rpc("consume_rate_limit", {
        p_bucket: bucket,
        p_max: max,
        p_window_seconds: windowSeconds,
      });
      if (error) throw new RepositoryError("consume_rate_limit", error);
      return data === true;
    },
  };
}
