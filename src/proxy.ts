import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth/redirect";
import { HOME_PATH, LOGIN_PATH, isAuthPage, isPublicPath } from "@/lib/auth/routes";
import { buildCsp, generateNonce } from "@/lib/security/csp";
import { sessionCookieOptions } from "@/server/supabase/cookie-options";

/**
 * Proxy (en Next.js 16 reemplaza a `middleware.ts`; corre en Node.js).
 *
 * En cada navegación:
 * 1. Refresca la sesión de Supabase si el token venció (y guarda las
 *    cookies nuevas en la respuesta).
 * 2. Sin sesión en una ruta privada → /login?next=<ruta>.
 *    Con sesión en /login o /registro → inicio.
 * 3. Genera el nonce y la CSP.
 *
 * Importante: esto es una comodidad de navegación, NO la única barrera.
 * Cada página privada vuelve a verificar con requireUser() y la base de
 * datos aplica RLS. Así, aunque el proxy fallara o se salteara, los datos
 * siguen protegidos.
 */
export async function proxy(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  }

  // --- 1. Sesión -----------------------------------------------------------
  type PendingCookie = { name: string; value: string; options: object };
  const pendingCookies: PendingCookie[] = [];
  const pendingHeaders: Record<string, string> = {};

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookieOptions: sessionCookieOptions,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const cookie of cookiesToSet) {
          // Para que el render de este mismo request vea la sesión nueva…
          request.cookies.set(cookie.name, cookie.value);
          // …y para mandarla al navegador.
          pendingCookies.push({
            name: cookie.name,
            value: cookie.value,
            options: { ...cookie.options, ...sessionCookieOptions },
          });
        }
        // Incluye Cache-Control: private, no-store para que ningún CDN
        // guarde una respuesta con la sesión de otra persona.
        Object.assign(pendingHeaders, headers);
      },
    },
  });

  // getClaims() verifica la firma del token (y lo refresca si venció).
  const { data } = await supabase.auth.getClaims();
  const isSignedIn = Boolean(data?.claims.sub);

  const { pathname, search } = request.nextUrl;

  const finalize = (response: NextResponse) => {
    for (const { name, value, options } of pendingCookies) {
      response.cookies.set(name, value, options);
    }
    for (const [key, value] of Object.entries(pendingHeaders)) {
      response.headers.set(key, value);
    }
    return response;
  };

  // --- 2. Rutas -------------------------------------------------------------
  if (!isSignedIn && !isPublicPath(pathname)) {
    const loginUrl = new URL(LOGIN_PATH, request.url);
    const next = safeNextPath(pathname + search, "");
    if (next && next !== HOME_PATH) loginUrl.searchParams.set("next", next);
    return finalize(NextResponse.redirect(loginUrl, 303));
  }

  if (isSignedIn && isAuthPage(pathname)) {
    return finalize(NextResponse.redirect(new URL(HOME_PATH, request.url), 303));
  }

  // --- 3. CSP con nonce -----------------------------------------------------
  const nonce = generateNonce();
  const csp = buildCsp({ nonce, isDev: process.env.NODE_ENV === "development" });

  // Next.js lee la CSP de los headers del *request* para aplicar el nonce
  // a sus propios scripts; `x-nonce` lo usamos nosotros en el layout.
  // Se arma DESPUÉS del refresco para incluir las cookies actualizadas.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return finalize(response);
}

export const config = {
  matcher: [
    /*
     * Todas las rutas menos:
     * - api/ (Route Handlers: verifican la sesión por su cuenta)
     * - _next/static, _next/image (assets con hash)
     * - sw.js, offline.html y archivos estáticos con extensión, que
     *   reciben su propia CSP fija desde next.config.ts
     * - prefetches de <Link> (las páginas igual verifican la sesión)
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
