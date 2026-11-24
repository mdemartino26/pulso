"use client";

import { useActionState } from "react";
import { Undo2 } from "lucide-react";
import { initialFormState } from "@/features/auth/form-state";
import { tileButton } from "@/components/tile";
import { addWaterAction, undoWaterAction } from "../actions";

function AddWater({ date, amount }: { date: string; amount: number }) {
  const [state, formAction, pending] = useActionState(addWaterAction, initialFormState);
  return (
    <form action={formAction}>
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="amountMl" value={amount} />
      <button type="submit" className={tileButton} disabled={pending} aria-label={`Sumar ${amount} ml de agua`}>
        +{amount}
      </button>
      {state.status === "error" ? <span className="sr-only" role="alert">{state.message}</span> : null}
    </form>
  );
}

/** +250 / +500 con un toque, y deshacer el último. */
export function WaterButtons({ date, canUndo }: { date: string; canUndo: boolean }) {
  const [, undo, undoPending] = useActionState(undoWaterAction, initialFormState);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <AddWater date={date} amount={250} />
      <AddWater date={date} amount={500} />
      {canUndo ? (
        <form action={undo}>
          <input type="hidden" name="date" value={date} />
          <button type="submit" className={tileButton} disabled={undoPending} aria-label="Deshacer el último vaso">
            <Undo2 aria-hidden className="size-4" />
          </button>
        </form>
      ) : null}
    </div>
  );
}
