import { describe, expect, it } from "vitest";
import { buildCsp, generateNonce } from "./csp";

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
  const csp = buildCsp({ nonce: "abc123", isDev: false });

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

  it("connect-src solo permite la propia app (Supabase se usa desde el servidor)", () => {
    expect(directive(csp, "connect-src")).toBe("connect-src 'self'");
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
  const csp = buildCsp({ nonce: "n", isDev: true });

  it("agrega unsafe-eval solo en dev y no fuerza https", () => {
    expect(directive(csp, "script-src")).toContain("'unsafe-eval'");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });
});
