import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteCustomFoodAction, updateCustomFoodAction } from "@/features/food/actions";
import { ActionButton } from "@/features/food/components/action-form";
import { CustomFoodForm } from "@/features/food/components/custom-food-form";
import { requireCompleteProfile } from "@/server/auth/profile-guard";
import { foodDeps } from "@/server/services/food-deps";
import { getCustomFood } from "@/server/services/food-service";

export const metadata: Metadata = { title: "Editar alimento" };

const s = (v: number | null | undefined) => (v == null ? "" : String(v).replace(".", ","));

export default async function EditCustomFoodPage({ params }: PageProps<"/comidas/alimentos/[id]">) {
  const { user } = await requireCompleteProfile();
  const { id } = await params;
  const food = await getCustomFood(await foodDeps(user.id), user.id, id);
  if (!food) notFound();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-10">
      <header>
        <Button asChild variant="ghost" size="sm">
          <Link href="/comidas/alimentos">
            <ChevronLeft aria-hidden />
            Mis alimentos
          </Link>
        </Button>
      </header>
      <h1 className="text-2xl font-semibold tracking-tight">Editar alimento</h1>
      <p className="text-muted-foreground text-sm">Los cambios valen para lo que registres desde ahora. Lo que ya anotaste no cambia.</p>
      <CustomFoodForm
        action={updateCustomFoodAction}
        hidden={{ id: food.id }}
        submitLabel="Guardar cambios"
        defaults={{
          name: food.name,
          brand: food.brand ?? "",
          basis: food.basis,
          kcal100: s(food.per100.kcal),
          protein100: s(food.per100.protein),
          carbs100: s(food.per100.carbs),
          fat100: s(food.per100.fat),
          fiber100: s(food.per100.fiber),
          sugars100: s(food.per100.sugars),
          sodiumMg100: s(food.per100.sodiumMg),
          servingSize: s(food.serving?.size),
          servingLabel: food.serving?.label ?? "",
        }}
      />
      <ActionButton action={deleteCustomFoodAction} fields={{ id: food.id }} pendingLabel="Borrando…" variant="ghost">
        Borrar alimento
      </ActionButton>
    </main>
  );
}
