import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth/redirect";
import { exchangeCodeForSession } from "@/server/services/auth-service";

/** Vuelta de Google (y de links de mail con código PKCE). */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const next = safeNextPath(params.get("next"));

  if (code && code.length <= 512) {
    const result = await exchangeCodeForSession(code);
    if (result.ok) return NextResponse.redirect(new URL(next, request.url), 303);
  }

  // Nunca se reenvía el error de Google/Supabase a la pantalla: solo un código fijo.
  return NextResponse.redirect(new URL("/login?error=link", request.url), 303);
}
