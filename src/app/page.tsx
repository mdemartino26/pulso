import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Pantalla provisoria de la Etapa 1. En la Etapa 7 se reemplaza por el
 * panel del día (y en la Etapa 3 pasa a ser una ruta privada).
 */
export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Pulso</h1>
        <ThemeToggle />
      </header>

      <section className="rounded-xl border bg-card p-5 text-card-foreground shadow-xs">
        <h2 className="text-lg font-medium">¡Hola!</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          La base de la app está lista: PWA instalable, modo claro y oscuro y headers de
          seguridad. En las próximas etapas llegan la base de datos, el login y los registros.
        </p>
      </section>
    </main>
  );
}
