import { toCsv } from "@/lib/export/csv";
import type { ExportRepository, ExportTable } from "@/server/repositories/export-repository";
import type { RateLimiter } from "@/server/repositories/food-types";

/**
 * Exportar los datos de la persona (derecho de acceso y portabilidad).
 * JSON con todo junto, o un CSV por tabla.
 */

export interface ExportDeps {
  repo: ExportRepository;
  rateLimiter: RateLimiter;
  now: () => Date;
}

export const EXPORT_TABLES = [
  "perfil",
  "pesos",
  "metas_diarias",
  "comidas",
  "alimentos_propios",
  "actividades",
  "series_fuerza",
  "pasos",
  "agua",
  "sueno_y_animo",
  "habitos",
  "habitos_marcados",
] as const;
export type ExportTableName = (typeof EXPORT_TABLES)[number];

export type ExportRequest = { format: "json" } | { format: "csv"; table: ExportTableName };

/** Valida los parámetros de la URL contra listas cerradas. */
export function parseExportRequest(format: string | null, table: string | null): ExportRequest | null {
  if (format === "json") return { format: "json" };
  if (format === "csv" && (EXPORT_TABLES as readonly string[]).includes(table ?? "")) {
    return { format: "csv", table: table as ExportTableName };
  }
  return null;
}

export interface ExportFile {
  filename: string;
  contentType: string;
  body: string;
}

export type ExportResult = { ok: true; file: ExportFile } | { ok: false; code: "rate_limited" };

export async function exportData(deps: ExportDeps, userId: string, req: ExportRequest): Promise<ExportResult> {
  if (!(await deps.rateLimiter.consume("data_export", 10, 60))) return { ok: false, code: "rate_limited" };
  const tables = await deps.repo.tables(userId);
  const stamp = deps.now().toISOString().slice(0, 10);

  if (req.format === "json") {
    const data: Record<string, ExportTable["rows"]> = {};
    for (const t of tables) data[t.name] = t.rows;
    return {
      ok: true,
      file: {
        filename: `pulso-datos-${stamp}.json`,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ app: "Pulso", exportedAt: deps.now().toISOString(), version: 1, data }, null, 2),
      },
    };
  }
  const t = tables.find((x) => x.name === req.table);
  return {
    ok: true,
    file: {
      filename: `pulso-${req.table}-${stamp}.csv`,
      contentType: "text/csv; charset=utf-8",
      body: toCsv(t?.columns ?? [], t?.rows ?? []),
    },
  };
}
