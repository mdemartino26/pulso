import { describe, expect, it } from "vitest";
import { safeNextPath } from "./redirect";

describe("safeNextPath", () => {
  it("acepta rutas internas con query y hash", () => {
    expect(safeNextPath("/comidas")).toBe("/comidas");
    expect(safeNextPath("/dia?fecha=2026-11-24#cena")).toBe("/dia?fecha=2026-11-24#cena");
  });

  it("usa el fallback si no hay valor", () => {
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath(undefined)).toBe("/");
    expect(safeNextPath("", "/perfil")).toBe("/perfil");
  });

  it.each([
    "https://malo.com",
    "http://malo.com/login",
    "//malo.com",
    "/\\malo.com",
    "\\\\malo.com",
    "javascript:alert(1)",
    "data:text/html,hola",
    "malo.com",
    "/ok\n//malo.com",
    "/\tmalo",
    `/${"a".repeat(600)}`,
  ])("rechaza %j (open redirect)", (value) => {
    expect(safeNextPath(value)).toBe("/");
  });
});
