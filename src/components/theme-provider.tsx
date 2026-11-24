"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

/**
 * Modo claro/oscuro. next-themes inyecta un script inline chiquito para
 * evitar el "flash" de tema incorrecto: le pasamos el nonce para que la
 * CSP lo permita sin necesitar 'unsafe-inline'.
 */
export function ThemeProvider(props: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props} />;
}
