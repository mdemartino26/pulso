import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MEAL_LABELS } from "@/lib/food";
import { AddFood } from "@/features/food/components/add-food";
import { dayLabel, pickDate } from "@/features/food/dates";
import { parseRefParam, pickMeal } from "@/features/food/server-helpers";
import { requireCompleteProfile } from "@/server/auth/profile-guard";
import { foodDeps } from "@/server/services/food-deps";
import { getFavoriteFoods, getFood, getRecentFoods, listCustomFoods } from "@/server/services/food-service";

export const metadata: Metadata = { title: "Agregar comida" };

export default async function AddFoodPage({ searchParams }: PageProps<"/comidas/agregar">) {
  const { user, overview } = await requireCompleteProfile();
  const sp = await searchParams;
  const date = pickDate(sp.fecha, overview.today);
  const meal = pickMeal(sp.comida, overview.profile.timezone);
  const deps = await foodDeps(user.id);
  const ref = parseRefParam(sp.alimento);

  const [recent, favorites, mine, preselected] = await Promise.all([
    getRecentFoods(deps, user.id),
    getFavoriteFoods(deps, user.id),
    listCustomFoods(deps, user.id),
    ref ? getFood(deps, user.id, ref) : Promise.resolve(null),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-8 md:px-2 md:pt-2">
      <header className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" aria-label="Volver">
          <Link href={`/comidas?fecha=${date}`}>
            <ChevronLeft aria-hidden />
          </Link>
        </Button>
        <h1 className="text-xl font-semibold">
          {MEAL_LABELS[meal]} <span className="text-muted-foreground text-base font-normal lowercase">· {dayLabel(date, overview.today)}</span>
        </h1>
      </header>
      <AddFood date={date} meal={meal} recent={recent} favorites={favorites} mine={mine} preselected={preselected} />
    </main>
  );
}
