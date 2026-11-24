"use client";

import { Button } from "@/components/ui/button";

/**
 * Error inesperado en cualquier pantalla. Nunca muestra el mensaje ni el
 * stack: en producción Next.js ya los oculta, y acá tampoco los usamos.
 * `digest` es un id para buscar el error en los logs del servidor.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-semibold">Algo no salió como esperábamos</h1>
      <p className="text-muted-foreground text-sm">
        No se perdió nada de lo que ya tenías guardado. Probá de nuevo en un momento.
      </p>
      <Button onClick={reset}>Reintentar</Button>
    </main>
  );
}
