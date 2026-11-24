import { NextResponse, type NextRequest } from "next/server";
import { buildCsp, generateNonce } from "@/lib/security/csp";

/**
 * Proxy (en Next.js 16 reemplaza a `middleware.ts`; corre en Node.js).
 *
 * Etapa 1: genera un nonce por request y arma la CSP.
 * Etapa 3: acá se suma el refresco de la sesión de Supabase y la
 * protección de rutas privadas, reutilizando esta misma respuesta.
 */
export function proxy(request: NextRequest) {
  const nonce = generateNonce();
  const csp = buildCsp({
    nonce,
    isDev: process.env.NODE_ENV === "development",
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });

  // Next.js lee la CSP de los headers del *request* para aplicar el nonce
  // a sus propios scripts; `x-nonce` lo usamos nosotros en el layout.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    /*
     * Todas las rutas menos:
     * - api/ (Route Handlers: devuelven JSON, no HTML)
     * - _next/static, _next/image (assets con hash)
     * - sw.js, offline.html y archivos estáticos con extensión, que
     *   reciben su propia CSP fija desde next.config.ts
     * - prefetches de <Link> (no ejecutan HTML)
     */
    {
      source:
        "/((?!api/|_next/static|_next/image|sw\\.js|offline\\.html|.*\\.(?:ico|png|svg|jpg|jpeg|webp|css|js|txt|xml|webmanifest)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
