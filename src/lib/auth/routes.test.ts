import { describe, expect, it } from "vitest";
import { isAuthPage, isPublicPath } from "./routes";

describe("isPublicPath", () => {
  it("las páginas de acceso y /auth/* son públicas", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/registro")).toBe(true);
    expect(isPublicPath("/recuperar-contrasena")).toBe(true);
    expect(isPublicPath("/auth/callback")).toBe(true);
  });

  it("todo lo demás es privado por defecto", () => {
    expect(isPublicPath("/")).toBe(false);
    expect(isPublicPath("/perfil")).toBe(false);
    expect(isPublicPath("/restablecer-contrasena")).toBe(false);
    expect(isPublicPath("/login/otra")).toBe(false);
    expect(isPublicPath("/authx")).toBe(false);
  });
});

describe("isAuthPage", () => {
  it("solo login, registro y recuperar", () => {
    expect(isAuthPage("/login")).toBe(true);
    expect(isAuthPage("/auth/callback")).toBe(false);
    expect(isAuthPage("/")).toBe(false);
  });
});
