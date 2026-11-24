import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { createRateLimiter } from "@/server/repositories/food-repositories";
import { createExportRepository } from "@/server/repositories/export-repository";
import { exportData, parseExportRequest } from "@/server/services/export-service";
import { createSupabaseServerClient } from "@/server/supabase/server";

const NO_STORE = { "Cache-Control": "private, no-store" };

/**
 * GET /api/export?formato=json
 * GET /api/export?formato=csv&tabla=comidas
 * Descarga los datos de la persona con su sesión (RLS): nunca se pueden
 * pedir los de otra. Parámetros validados contra listas cerradas.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "unauthorized", message: "Tu sesión venció. Volvé a entrar." }, { status: 401, headers: NO_STORE });
    const params = request.nextUrl.searchParams;
    const req = parseExportRequest(params.get("formato"), params.get("tabla"));
    if (!req) return NextResponse.json({ error: "invalid_input", message: "Formato no válido." }, { status: 400, headers: NO_STORE });

    const db = await createSupabaseServerClient();
    const result = await exportData({ repo: createExportRepository(db), rateLimiter: createRateLimiter(db), now: () => new Date() }, user.id, req);
    if (!result.ok) {
      return NextResponse.json(
        { error: "rate_limited", message: "Fueron muchas descargas seguidas. Esperá un minuto." },
        { status: 429, headers: { ...NO_STORE, "Retry-After": "60" } },
      );
    }
    const { filename, contentType, body } = result.file;
    return new Response(body, {
      headers: {
        ...NO_STORE,
        "Content-Type": contentType,
        // El nombre lo arma el servidor con valores de una lista cerrada (no hay inyección de headers).
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    console.error("[api/export] error inesperado", e instanceof Error ? e.name : "unknown");
    return NextResponse.json({ error: "server_error", message: "No pudimos preparar la descarga. Probá de nuevo." }, { status: 500, headers: NO_STORE });
  }
}
