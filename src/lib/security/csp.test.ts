import { describe, expect, it } from "vitest";
import { buildCsp, generateNonce, safeOrigin } from "./csp";

function directive(csp: string, name: string): string | undefined {
  return csp
    .split(";")
    .map((d) => d.trim())
    .find((d) => d.startsWith(`${name} `) || d === name);
}

describe("generateNonce", () => {
  it("genera nonces base64 de 128 bits distintos en cada llamada", () => {
    const a = generateNonce();
    const b = generateNonce();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9+/]{22}==$/);
  });
});

describe("buildCsp en producción", () => {
  const csp = buildCsp({
    nonce: "abc123",
    isDev: false,
    supabaseUrl: "https://proyecto.supabase.co",
  });

  it("solo permite scripts con nonce y strict-dynamic, sin eval ni inline", () => {
    const scripts = directive(csp, "script-src");
    expect(scripts).toContain("'nonce-abc123'");
    expect(scripts).toContain("'strict-dynamic'");
    expect(scripts).not.toContain("unsafe-eval");
    expect(scripts).not.toContain("unsafe-inline");
  });

  it("estilos con nonce, sin unsafe-inline en style-src", () => {
    expect(directive(csp, "style-src")).toBe("style-src 'self' 'nonce-abc123'");
  });

  it("permite el service worker y el manifest del mismo origen", () => {
    expect(directive(csp, "worker-src")).toBe("worker-src 'self'");
    expect(directive(csp, "manifest-src")).toBe("manifest-src 'self'");
  });

  it("connect-src solo incluye la app y Supabase (https y wss)", () => {
    expect(directive(csp, "connect-src")).toBe(
      "connect-src 'self' https://proyecto.supabase.co wss://proyecto.supabase.co",
    );
  });

  it("permite imágenes de Open Food Facts", () => {
    expect(directive(csp, "img-src")).toContain("https://images.openfoodfacts.org");
  });

  it("bloquea iframes, plugins y cambios de base", () => {
    expect(directive(csp, "frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive(csp, "object-src")).toBe("object-src 'none'");
    expect(directive(csp, "base-uri")).toBe("base-uri 'self'");
    expect(csp).toContain("upgrade-insecure-requests");
  });
});

describe("buildCsp en desarrollo", () => {
  const csp = buildCsp({ nonce: "n", isDev: true, supabaseUrl: undefined });

  it("agrega unsafe-eval solo en dev y no fuerza https", () => {
    expect(directive(csp, "script-src")).toContain("'unsafe-eval'");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });

  it("sin URL de Supabase, connect-src queda en 'self'", () => {
    expect(directive(csp, "connect-src")).toBe("connect-src 'self'");
  });
});

describe("safeOrigin", () => {
  it("rechaza URLs inválidas o sin https", () => {
    expect(safeOrigin("no es una url")).toBeNull();
    expect(safeOrigin("http://proyecto.supabase.co")).toBeNull();
    expect(safeOrigin("javascript:alert(1)")).toBeNull();
  });

  it("acepta https y http solo en localhost (Supabase local)", () => {
    expect(safeOrigin("https://x.supabase.co")?.origin).toBe("https://x.supabase.co");
    expect(safeOrigin("http://127.0.0.1:54321")?.origin).toBe("http://127.0.0.1:54321");
  });

  it("no permite inyectar directivas extra en la CSP", () => {
    const csp = buildCsp({
      nonce: "n",
      isDev: false,
      supabaseUrl: "https://x.supabase.co; script-src *",
    });
    expect(directive(csp, "connect-src")).not.toContain("script-src");
    expect(csp.match(/script-src /g)).toHaveLength(1);
  });
});
