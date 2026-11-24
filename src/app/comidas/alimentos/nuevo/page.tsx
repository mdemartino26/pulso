import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createCustomFoodAction } from "@/features/food/actions";
import { CustomFoodForm, EMPTY_CUSTOM_FOOD } from "@/features/food/components/custom-food-form";
import { requireCompleteProfile } from "@/server/auth/profile-guard";

export const metadata: Metadata = { title: "Nuevo alimento" };

/** Solo volvemos a "agregar comida" (ruta interna con formato fijo): nada de redirecciones abiertas. */
const RETURN_TO = /^\/comidas\/agregar\?fecha=\d{4}-\d{2}-\d{2}&comida=[a-z_]+$/;

export default async function NewCustomFoodPage({ searchParams }: PageProps<"/comidas/alimentos/nuevo">) {
  await requireCompleteProfile();
  const { volver } = await searchParams;
  const returnTo = typeof volver === "string" && RETURN_TO.test(volver) ? volver : null;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-10">
      <header>
        <Button asChild variant="ghost" size="sm">
          <Link href={returnTo ?? "/comidas/alimentos"}>
            <ChevronLeft aria-hidden />
            Volver
          </Link>
        </Button>
      </header>
      <h1 className="text-2xl font-semibold tracking-tight">Nuevo alimento</h1>
      <CustomFoodForm
        action={createCustomFoodAction}
        defaults={EMPTY_CUSTOM_FOOD}
        hidden={returnTo ? { returnTo } : {}}
        submitLabel={returnTo ? "Guardar y elegir porción" : "Guardar"}
      />
    </main>
  );
}
