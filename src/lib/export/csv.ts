/**
 * CSV seguro para abrir en Excel / Google Sheets.
 *
 * - Separador coma, fin de línea CRLF y BOM UTF-8 para que Excel lea bien
 *   los acentos.
 * - Evita la "inyección de fórmulas": un valor que empieza con = + - @ o
 *   tabulación se ejecutaría como fórmula al abrir el archivo (por ejemplo,
 *   el nombre de un alimento que vino de Open Food Facts). Se le antepone
 *   un apóstrofo para que se vea como texto. Los números no se tocan.
 */

export type CsvValue = string | number | boolean | null | undefined;

const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return value ? "true" : "false";
  let s = value;
  if (FORMULA_START.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(columns: readonly string[], rows: readonly Record<string, CsvValue>[]): string {
  const lines = [columns.map(csvCell).join(",")];
  for (const row of rows) lines.push(columns.map((c) => csvCell(row[c])).join(","));
  return "﻿" + lines.join("\r\n") + "\r\n";
}
