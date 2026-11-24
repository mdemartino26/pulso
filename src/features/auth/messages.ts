/**
 * Mensajes de error que ve el usuario. Siempre textos fijos: nunca se
 * muestra un mensaje que venga de Supabase, Google o de la URL.
 */
export const AUTH_MESSAGES = {
  invalid_credentials: "El email o la contraseña no coinciden. Probá de nuevo.",
  email_not_confirmed: "Te falta confirmar tu email. Buscá el mail que te mandamos (fijate en spam).",
  rate_limited: "Hubo muchos intentos seguidos. Esperá unos minutos y probá de nuevo.",
  weak_password: "Esa contraseña es muy fácil de adivinar. Probá con otra más larga.",
  same_password: "La contraseña nueva tiene que ser distinta de la anterior.",
  not_authenticated: "El link para cambiar la contraseña venció. Pedí uno nuevo.",
  link_invalid: "El link venció o ya se usó. Pedí uno nuevo.",
  unknown: "Algo salió mal de nuestro lado. Probá de nuevo en un rato.",
} as const;

/** Errores que pueden llegar por URL a /login (?error=...). Lista cerrada. */
/** Avisos neutros (no errores) que se pueden pedir por URL con ?aviso=. */
export const LOGIN_URL_NOTICES: Record<string, string> = {
  cuenta_borrada: "Tu cuenta y todos tus datos se borraron. Gracias por haber usado Pulso.",
};

export const LOGIN_URL_ERRORS: Record<string, string> = {
  link: AUTH_MESSAGES.link_invalid,
  google: "No pudimos conectar con Google. Probá de nuevo o entrá con tu email.",
};
