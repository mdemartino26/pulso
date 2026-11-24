import type { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { jsonError, jsonResult, safely } from "@/server/food/http";
import { foodDeps } from "@/server/services/food-deps";
import { searchFoods } from "@/server/services/food-service";

/**
 * GET /api/foods/search?q=yogur
 * Busca en USDA y Open Food Facts DESDE EL SERVIDOR: la API key de USDA
 * nunca llega al navegador. Requiere sesión y tiene límite por usuario.
 */
export async function GET(request: NextRequest) {
  return safely(async () => {
    const user = await getSessionUser();
    if (!user) return jsonError(401);
    const q = request.nextUrl.searchParams.get("q");
    return jsonResult(await searchFoods(await foodDeps(user.id), user.id, q));
  });
}
