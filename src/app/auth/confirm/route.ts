import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth/redirect";
import { isAllowedOtpType, verifyEmailLink } from "@/server/services/auth-service";

/**
 * Links de los mails (confirmar cuenta, recuperar contraseña) con
 * token_hash. A diferencia de PKCE, funcionan aunque el mail se abra en
 * otro dispositivo. Requiere ajustar las plantillas de mail en Supabase.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type");
  const fallback = type === "recovery" ? "/restablecer-contrasena" : "/";
  const next = safeNextPath(params.get("next"), fallback);

  if (tokenHash && tokenHash.length <= 512 && isAllowedOtpType(type)) {
    const result = await verifyEmailLink(tokenHash, type);
    if (result.ok) return NextResponse.redirect(new URL(next, request.url), 303);
  }

  return NextResponse.redirect(new URL("/login?error=link", request.url), 303);
}
