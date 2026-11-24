import "server-only";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/server/supabase/server";

/**
 * Servicio de autenticación: la única parte de la app que conoce la API de
 * Supabase Auth. Las Server Actions y Route Handlers usan esto, y la UI solo
 * ve códigos de error propios (nunca mensajes internos de Supabase).
 */

export type AuthErrorCode =
  | "invalid_credentials"
  | "email_not_confirmed"
  | "rate_limited"
  | "weak_password"
  | "same_password"
  | "not_authenticated"
  | "link_invalid"
  | "unknown";

export type AuthResult = { ok: true } | { ok: false; code: AuthErrorCode };

const OK: AuthResult = { ok: true };

function fail(code: AuthErrorCode): AuthResult {
  return { ok: false, code };
}

/** Traduce errores de Supabase a códigos propios y registra lo mínimo. */
function mapError(where: string, error: { code?: string | undefined; status?: number | undefined }): AuthResult {
  switch (error.code) {
    case "invalid_credentials":
      return fail("invalid_credentials");
    case "email_not_confirmed":
      return fail("email_not_confirmed");
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return fail("rate_limited");
    case "weak_password":
      return fail("weak_password");
    case "same_password":
      return fail("same_password");
    case "otp_expired":
    case "flow_state_expired":
    case "flow_state_not_found":
    case "bad_code_verifier":
      return fail("link_invalid");
    default:
      // Solo código y status: nunca emails, contraseñas ni tokens en los logs.
      console.error(`[auth] ${where} falló`, { code: error.code, status: error.status });
      return fail("unknown");
  }
}

function siteUrl(path: string): string {
  return new URL(path, getPublicEnv().NEXT_PUBLIC_SITE_URL).toString();
}

export async function signInWithPassword(email: string, password: string): Promise<AuthResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return error ? mapError("signIn", error) : OK;
}

/**
 * Registro. Con "Confirm email" activado en Supabase, si el email ya existe
 * Supabase responde igual que si fuera nuevo: así nadie puede averiguar
 * quién tiene cuenta.
 */
export async function signUp(email: string, password: string): Promise<AuthResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    // Con la plantilla de mail recomendada (ver docs) el link va a
    // /auth/confirm; si no, Supabase usa este redirectTo con un código PKCE.
    options: { emailRedirectTo: siteUrl("/auth/callback") },
  });
  if (error?.code === "user_already_exists") return OK; // misma respuesta: no revelar
  return error ? mapError("signUp", error) : OK;
}

/** Siempre responde OK (salvo rate limit) para no revelar si el email existe. */
export async function requestPasswordReset(email: string): Promise<AuthResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: siteUrl("/auth/callback?next=/restablecer-contrasena"),
  });
  if (!error) return OK;
  const mapped = mapError("resetPassword", error);
  return !mapped.ok && mapped.code === "rate_limited" ? mapped : OK;
}

export async function updatePassword(password: string): Promise<AuthResult> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims.sub) return fail("not_authenticated");
  const { error } = await supabase.auth.updateUser({ password });
  return error ? mapError("updatePassword", error) : OK;
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  // scope "local": cierra esta sesión (este dispositivo).
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) mapError("signOut", error);
}

/**
 * Inicia el login con Google. Devuelve la URL de Google a la que hay que
 * redirigir. El "code verifier" de PKCE queda en una cookie httpOnly: el
 * código que vuelve de Google solo sirve en ESTE navegador.
 */
export async function startGoogleSignIn(next: string): Promise<{ url: string } | null> {
  const supabase = await createSupabaseServerClient();
  const callback = new URL(siteUrl("/auth/callback"));
  callback.searchParams.set("next", next);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callback.toString(), skipBrowserRedirect: true },
  });
  if (error || !data.url) {
    if (error) mapError("googleStart", error);
    return null;
  }
  return { url: data.url };
}

/** Vuelta de Google (u otro flujo PKCE): canjea el código por una sesión. */
export async function exchangeCodeForSession(code: string): Promise<AuthResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  return error ? mapError("exchangeCode", error) : OK;
}

const ALLOWED_OTP_TYPES = new Set<EmailOtpType>(["email", "signup", "recovery", "email_change"]);

export function isAllowedOtpType(type: string | null): type is EmailOtpType {
  return type !== null && ALLOWED_OTP_TYPES.has(type as EmailOtpType);
}

/** Links de los mails (confirmar cuenta, recuperar contraseña). */
export async function verifyEmailLink(tokenHash: string, type: EmailOtpType): Promise<AuthResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  return error ? mapError("verifyOtp", error) : OK;
}
