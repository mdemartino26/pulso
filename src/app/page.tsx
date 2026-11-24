import { ThemeToggle } from "@/components/theme-toggle";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { requireUser } from "@/server/auth/session";

/**
 * Pantalla provisoria. En la Etapa 4 se suma el onboarding y en la 7 se
 * reemplaza por el panel del día.
 */
export default async function HomePage() {
  await requireUser();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Pulso</h1>
        <div className="flex items-center gap-1">
          <SignOutButton />
          <ThemeToggle />
        </div>
      </header>

      <section className="bg-card text-card-foreground rounded-xl border p-5 shadow-xs">
        <h2 className="text-lg font-medium">¡Ya estás adentro!</h2>
        <p className="text-muted-foreground mt-2 text-sm">
          Tu sesión está iniciada. En la próxima etapa armamos tu perfil y tus metas.
        </p>
      </section>
    </main>
  );
}
