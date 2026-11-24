import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "./csv";

describe("csv", () => {
  it("escapa comillas, comas y saltos de línea", () => {
    expect(csvCell('Yogur "light", entero')).toBe('"Yogur ""light"", entero"');
    expect(csvCell("a\nb")).toBe('"a\nb"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(12.5)).toBe("12.5");
  });

  it("neutraliza fórmulas (inyección CSV)", () => {
    expect(csvCell("=HYPERLINK(\"http://x\")")).toBe("\"'=HYPERLINK(\"\"http://x\"\")\"");
    expect(csvCell("+54 11")).toBe("'+54 11");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell(-3)).toBe("-3");
  });

  it("arma el archivo con BOM y CRLF", () => {
    const out = toCsv(["fecha", "kcal"], [{ fecha: "2026-11-24", kcal: 300 }]);
    expect(out).toBe("﻿fecha,kcal\r\n2026-11-24,300\r\n");
  });
});
