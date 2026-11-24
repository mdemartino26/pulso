import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireCompleteProfile } from "@/server/auth/profile-guard";
import { foodDeps } from "@/server/services/food-deps";
import { listCustomFoods } from "@/server/services/food-service";

export const metadata: Metadata = { title: "Mis alimentos" };

export default async function CustomFoodsPage() {
  const { user } = await requireCompleteProfile();
  const foods = await listCustomFoods(await foodDeps(user.id), user.id);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-8 md:px-2 md:pt-2">
      <header className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/comidas">
            <ChevronLeft aria-hidden />
            Comidas
          </Link>
        </Button>
        <Button asChild size="sm">
          <Link href="/comidas/alimentos/nuevo">
            <Plus aria-hidden />
            Nuevo
          </Link>
        </Button>
      </header>
      <h1 className="text-2xl font-semibold tracking-tight">Mis alimentos</h1>
      {foods.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Acá vas a ver los alimentos y recetas que cargues a mano. Son solo tuyos.
        </p>
      ) : (
        <ul className="bg-card divide-y overflow-hidden rounded-3xl border backdrop-blur-xl">
          {foods.map((f) => (
            <li key={f.ref.id}>
              <Link href={`/comidas/alimentos/${f.ref.id}`} className="hover:bg-accent/50 block px-4 py-3">
                <span className="block text-sm font-medium">{f.name}</span>
                <span className="text-muted-foreground text-xs">
                  {f.brand ? `${f.brand} · ` : ""}
                  {Math.round(f.per100.kcal)} kcal / 100 {f.basis}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
