import { getSessionUser } from "@/server/auth/session";
import { jsonError, jsonResult, safely } from "@/server/food/http";
import { foodDeps } from "@/server/services/food-deps";
import { lookupBarcode } from "@/server/services/food-service";

/** GET /api/foods/barcode/7790580660000 — busca un producto por código de barras. */
export async function GET(_request: Request, ctx: RouteContext<"/api/foods/barcode/[code]">) {
  return safely(async () => {
    const user = await getSessionUser();
    if (!user) return jsonError(401);
    const { code } = await ctx.params;
    return jsonResult(await lookupBarcode(await foodDeps(user.id), user.id, code));
  });
}
