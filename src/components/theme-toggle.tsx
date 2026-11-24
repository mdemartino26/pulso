"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

const noopSubscribe = () => () => {};

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // En el servidor no se sabe el tema (se guarda en el navegador): hasta
  // hidratar usamos un texto neutro para que el HTML coincida.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const next = resolvedTheme === "dark" ? "light" : "dark";
  const label = !mounted ? "Cambiar tema" : next === "dark" ? "Activar modo oscuro" : "Activar modo claro";

  return (
    <Button variant="ghost" size="icon" onClick={() => setTheme(next)} aria-label={label}>
      <Sun className="size-5 dark:hidden" aria-hidden />
      <Moon className="hidden size-5 dark:block" aria-hidden />
    </Button>
  );
}
