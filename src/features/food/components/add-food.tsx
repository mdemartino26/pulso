"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Plus, ScanLine, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addFoodEntryAction } from "@/features/food/actions";
import type { FoodView, Meal } from "@/lib/food";
import { cn } from "@/lib/utils";
import { BarcodeScanner } from "./barcode-scanner";
import { PortionForm } from "./portion-form";

type Tab = "recent" | "favorites" | "mine";

interface AddFoodProps {
  date: string;
  meal: Meal;
  recent: FoodView[];
  favorites: FoodView[];
  mine: FoodView[];
  preselected: FoodView | null;
}

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; foods: FoodView[]; partial: boolean }
  | { status: "error"; message: string };

const GENERIC_ERROR = "No pudimos buscar. Revisá tu conexión y probá de nuevo.";

async function readError(res: Response): Promise<string> {
  try {
    const body: unknown = await res.json();
    if (body && typeof body === "object" && "message" in body && typeof body.message === "string") return body.message;
  } catch {
    // respuesta sin JSON
  }
  return GENERIC_ERROR;
}

export function AddFood({ date, meal, recent, favorites, mine, preselected }: AddFoodProps) {
  const [tab, setTab] = useState<Tab>(recent.length > 0 ? "recent" : favorites.length > 0 ? "favorites" : "mine");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<SearchState>({ status: "idle" });
  const [selected, setSelected] = useState<FoodView | null>(preselected);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const backUrl = `/comidas/agregar?fecha=${date}&comida=${meal}`;

  // Búsqueda con espera de 350 ms para no pedir en cada tecla.
  useEffect(() => {
    const q = query.trim();
    abortRef.current?.abort();
    if (q.length < 2) return;
    const controller = new AbortController();
    abortRef.current = controller;
    const timer = setTimeout(async () => {
      setSearch({ status: "loading" });
      try {
        const res = await fetch(`/api/foods/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        if (!res.ok) return setSearch({ status: "error", message: await readError(res) });
        const data = (await res.json()) as { foods: FoodView[]; partial: boolean };
        setSearch({ status: "done", foods: data.foods, partial: data.partial });
      } catch (e) {
        if (!(e instanceof DOMException && e.name === "AbortError")) setSearch({ status: "error", message: GENERIC_ERROR });
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  async function onBarcode(code: string) {
    setScanning(false);
    setScanError(null);
    try {
      const res = await fetch(`/api/foods/barcode/${code}`);
      if (!res.ok) return setScanError(await readError(res));
      setSelected((await res.json()) as FoodView);
    } catch {
      setScanError(GENERIC_ERROR);
    }
  }

  if (selected) {
    return (
      <div className="grid gap-4">
        <Button type="button" variant="ghost" size="sm" className="justify-self-start" onClick={() => setSelected(null)}>
          <ChevronLeft aria-hidden />
          Elegir otro
        </Button>
        <PortionForm
          food={selected}
          meal={meal}
          action={addFoodEntryAction}
          submitLabel="Agregar"
          hidden={{ source: selected.ref.source, foodId: selected.ref.id, date }}
        />
      </div>
    );
  }

  const searching = query.trim().length >= 2;
  const lists: Record<Tab, { label: string; foods: FoodView[]; empty: string }> = {
    recent: { label: "Recientes", foods: recent, empty: "Lo que registres va a aparecer acá para cargarlo más rápido." },
    favorites: { label: "Favoritos", foods: favorites, empty: "Tocá la estrella de un alimento para tenerlo a mano." },
    mine: { label: "Mis alimentos", foods: mine, empty: "Creá tus propios alimentos o recetas." },
  };

  return (
    <div className="grid gap-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search aria-hidden className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            type="search"
            autoFocus
            enterKeyHint="search"
            aria-label="Buscar alimento"
            placeholder="Buscar alimento"
            maxLength={80}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-11 pl-9"
          />
        </div>
        <Button type="button" variant="outline" className="h-11" onClick={() => setScanning(true)} aria-label="Escanear código de barras">
          <ScanLine aria-hidden />
        </Button>
      </div>
      {scanError ? (
        <p role="alert" className="bg-muted rounded-md px-3 py-2 text-sm">
          {scanError}{" "}
          <Link className="underline" href={`/comidas/alimentos/nuevo?volver=${encodeURIComponent(backUrl)}`}>
            Cargarlo a mano
          </Link>
        </p>
      ) : null}

      {searching ? (
        <section aria-label="Resultados" aria-busy={search.status === "loading"} className="grid gap-2">
          {search.status === "loading" ? <p className="text-muted-foreground text-sm">Buscando…</p> : null}
          {search.status === "error" ? <p role="alert" className="bg-muted rounded-md px-3 py-2 text-sm">{search.message}</p> : null}
          {search.status === "done" ? (
            <>
              {search.partial ? (
                <p className="text-muted-foreground text-xs">Una de las bases no respondió: puede que falten resultados.</p>
              ) : null}
              <FoodList foods={search.foods} onPick={setSelected} empty="No encontramos nada con ese nombre." />
            </>
          ) : null}
        </section>
      ) : (
        <>
          <div role="tablist" aria-label="Listas" className="bg-muted grid grid-cols-3 gap-1 rounded-lg p-1">
            {(Object.keys(lists) as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={cn(
                  "h-9 rounded-md text-sm font-medium",
                  tab === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
                )}
              >
                {lists[t].label}
              </button>
            ))}
          </div>
          <div role="tabpanel" aria-label={lists[tab].label}>
            <FoodList foods={lists[tab].foods} onPick={setSelected} empty={lists[tab].empty} />
          </div>
        </>
      )}

      <Button asChild variant="ghost" className="justify-self-start">
        <Link href={`/comidas/alimentos/nuevo?volver=${encodeURIComponent(backUrl)}`}>
          <Plus aria-hidden />
          Crear un alimento
        </Link>
      </Button>

      {scanning ? <BarcodeScanner onCode={onBarcode} onClose={() => setScanning(false)} /> : null}
    </div>
  );
}

function FoodList({ foods, onPick, empty }: { foods: FoodView[]; onPick: (f: FoodView) => void; empty: string }) {
  if (foods.length === 0) return <p className="text-muted-foreground px-1 py-4 text-sm">{empty}</p>;
  return (
    <ul className="bg-card divide-y rounded-xl border">
      {foods.map((f) => (
        <li key={`${f.ref.source}:${f.ref.id}`}>
          <button
            type="button"
            onClick={() => onPick(f)}
            className="hover:bg-accent/50 flex w-full items-center gap-3 px-4 py-3 text-left"
          >
            {f.imageUrl ? (
              // Imagen de Open Food Facts: dominio permitido en la CSP, sin cookies ni referrer.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={f.imageUrl} alt="" width={36} height={36} loading="lazy" referrerPolicy="no-referrer" className="size-9 shrink-0 rounded object-cover" />
            ) : (
              <span aria-hidden className="bg-muted size-9 shrink-0 rounded" />
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{f.name}</span>
              <span className="text-muted-foreground block truncate text-xs">
                {f.brand ? `${f.brand} · ` : ""}
                {f.ref.source === "custom" ? "Mío · " : ""}
                {Math.round(f.per100.kcal)} kcal / 100 {f.basis}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
