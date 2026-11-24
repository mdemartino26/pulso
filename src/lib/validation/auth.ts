import { z } from "zod";

/**
 * Esquemas de autenticación. Se usan en el formulario (feedback inmediato)
 * y de nuevo en el servidor (la validación que cuenta).
 */

const email = z
  .string({ error: "Ingresá tu email" })
  .trim()
  .toLowerCase()
  .max(254, { error: "El email es demasiado largo" })
  .pipe(z.email({ error: "Revisá el email: no parece válido" }));

// 10 a 72 caracteres: 72 es el máximo que procesa bcrypt (Supabase Auth);
// lo que pase de ahí se ignoraría en silencio.
const newPassword = z
  .string({ error: "Ingresá una contraseña" })
  .min(10, { error: "Usá al menos 10 caracteres" })
  .max(72, { error: "Usá como máximo 72 caracteres" })
  .refine((v) => /[a-zA-Z]/.test(v) && /[0-9]/.test(v), {
    error: "Combiná letras y números",
  });

export const signInSchema = z.object({
  email,
  // Al iniciar sesión no se validan reglas: solo que no esté vacía.
  password: z.string().min(1, { error: "Ingresá tu contraseña" }).max(72),
});

export const signUpSchema = z
  .object({
    email,
    password: newPassword,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    error: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    password: newPassword,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    error: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
