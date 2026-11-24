import { describe, expect, it } from "vitest";
import { exportData, parseExportRequest, type ExportDeps } from "./export-service";

const tables = [
  { name: "pesos", columns: ["date", "weight_kg"], rows: [{ date: "2026-11-24", weight_kg: 70.5 }] },
  { name: "comidas", columns: ["date", "name", "kcal"], rows: [{ date: "2026-11-24", name: "=cmd|' /C calc'!A0", kcal: 100 }] },
];

function deps(allowed = true): ExportDeps & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    repo: { tables: async (uid) => (calls.push(uid), tables) },
    rateLimiter: { consume: async (bucket) => (calls.push(bucket), allowed) },
    now: () => new Date("2026-11-24T15:00:00Z"),
  };
}

describe("exportar datos", () => {
  it("solo acepta formatos y tablas de la lista", () => {
    expect(parseExportRequest("json", null)).toEqual({ format: "json" });
    expect(parseExportRequest("csv", "comidas")).toEqual({ format: "csv", table: "comidas" });
    expect(parseExportRequest("csv", "auth.users")).toBeNull();
    expect(parseExportRequest("xml", null)).toBeNull();
    expect(parseExportRequest(null, null)).toBeNull();
  });

  it("JSON con todas las tablas", async () => {
    const d = deps();
    const r = await exportData(d, "u1", { format: "json" });
    if (!r.ok) throw new Error("esperaba ok");
    expect(r.file.filename).toBe("pulso-datos-2026-11-24.json");
    const parsed = JSON.parse(r.file.body);
    expect(parsed.data.pesos[0].weight_kg).toBe(70.5);
    expect(d.calls).toEqual(["data_export", "u1"]);
  });

  it("CSV de una tabla, sin fórmulas ejecutables", async () => {
    const r = await exportData(deps(), "u1", { format: "csv", table: "comidas" });
    if (!r.ok) throw new Error("esperaba ok");
    expect(r.file.filename).toBe("pulso-comidas-2026-11-24.csv");
    expect(r.file.body).toContain("2026-11-24,'=cmd|' /C calc'!A0,100");
  });

  it("respeta el límite de descargas", async () => {
    const d = deps(false);
    expect(await exportData(d, "u1", { format: "json" })).toEqual({ ok: false, code: "rate_limited" });
    expect(d.calls).toEqual(["data_export"]);
  });
});
