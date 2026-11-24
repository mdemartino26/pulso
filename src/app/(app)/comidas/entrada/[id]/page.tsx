import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FoodView } from "@/lib/food";
import { deleteFoodEntryAction, updateFoodEntryAction } from "@/features/food/actions";
import { ActionButton } from "@/features/food/components/action-form";
import { PortionForm } from "@/features/food/components/portion-form";
import { requireCompleteProfile } from "@/server/auth/profile-guard";
import { foodDeps } from "@/server/services/food-deps";
import { getEntry } from "@/server/services/food-service";

export const metadata: Metadata = { title: "Editar comida" };

export default async function EditEntryPage({ params }: PageProps<"/comidas/entrada/[id]">) {
  const { user } = await requireCompleteProfile();
  const { id } = await params;
  const found = await getEntry(await foodDeps(user.id), user.id, id);
  if (!found) notFound();
  const { entry, food } = found;

  // Se edita con los valores que se guardaron al registrar (no cambian si
  // el alimento se actualizó después).
  const view: FoodView = {
    ref: entry.ref ?? { source: "custom", id: entry.id },
    name: entry.name,
    brand: entry.brand,
    basis: entry.basis,
    per100: entry.per100,
    serving: entry.unit === "serving" ? { size: entry.basePerUnit, label: food?.serving?.label ?? null } : (food?.serving ?? null),
    imageUrl: null,
    favorite: food?.favorite ?? false,
  };

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-8 md:px-2 md:pt-2">
      <header>
        <Button asChild variant="ghost" size="sm">
          <Link href={`/comidas?fecha=${entry.date}`}>
            <ChevronLeft aria-hidden />
            Volver
          </Link>
        </Button>
      </header>
      <PortionForm
        food={view}
        meal={entry.meal}
        action={updateFoodEntryAction}
        submitLabel="Guardar cambios"
        hidden={{ entryId: entry.id }}
        initial={{ quantity: entry.quantity, unit: entry.unit }}
        canFavorite={food !== null}
      />
      <ActionButton action={deleteFoodEntryAction} fields={{ entryId: entry.id }} pendingLabel="Borrando…" variant="ghost">
        Borrar de este día
      </ActionButton>
    </main>
  );
}
