import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth/redirect";
import { startGoogleSignIn } from "@/server/services/auth-service";

/**
 * GET /auth/google → redirige a Google.
 *
 * Es un link (navegación) y no un formulario a propósito: la CSP tiene
 * `form-action 'self'`, que bloquearía un formulario que termine en
 * accounts.google.com. Iniciar un login con la propia cuenta de Google no es
 * una acción peligrosa, y PKCE impide que un tercero complete el flujo.
 */
export async function GET(request: NextRequest) {
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  const result = await startGoogleSignIn(next);
  if (!result) {
    return NextResponse.redirect(new URL("/login?error=google", request.url), 303);
  }
  return NextResponse.redirect(result.url, 303);
}
