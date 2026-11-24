"use client";

import { useActionState, useState } from "react";
import { Archive, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormMessage } from "@/features/auth/components/form-message";
import { initialFormState } from "@/features/auth/form-state";
import { archiveHabitAction, createHabitAction, renameHabitAction } from "../actions";

const IDEAS = ["Caminar 20 minutos", "Comer verdura", "Leer 10 páginas", "Estirar", "Dormir antes de las 0"];

export function NewHabitForm({ suggest }: { suggest: boolean }) {
  const [state, formAction, pending] = useActionState(createHabitAction, initialFormState);
  const [name, setName] = useState("");
  // Al guardar bien se vacía el campo (ajuste de estado durante el render, sin efectos).
  const [seen, setSeen] = useState(state);
  if (seen !== state) {
    setSeen(state);
    if (state.status === "success") setName("");
  }
  return (
    <form action={formAction} className="grid gap-2">
      <Label htmlFor="habitName">Nuevo hábito</Label>
      <div className="flex gap-2">
        <Input
          id="habitName"
          name="name"
          maxLength={60}
          autoComplete="off"
          placeholder="Ej.: Tomar agua al despertar"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-11 flex-1"
          aria-invalid={state.fieldErrors?.name ? true : undefined}
        />
        <Button type="submit" className="h-11" disabled={pending || name.trim() === ""}>
          Agregar
        </Button>
      </div>
      {suggest ? (
        <div className="flex flex-wrap gap-2">
          {IDEAS.map((i) => (
            <Button key={i} type="button" variant="outline" size="sm" onClick={() => setName(i)}>
              {i}
            </Button>
          ))}
        </div>
      ) : null}
      {state.fieldErrors?.name ? <p className="text-destructive text-sm">{state.fieldErrors.name[0]}</p> : null}
      <FormMessage state={state} />
    </form>
  );
}

/** Fila de un hábito con renombrar y archivar (archivar conserva el historial). */
export function HabitRow({ id, name, done, window }: { id: string; name: string; done: number; window: number }) {
  const [editing, setEditing] = useState(false);
  const [renameState, rename, renaming] = useActionState(
    async (prev: Parameters<typeof renameHabitAction>[0], fd: FormData) => {
      const r = await renameHabitAction(prev, fd);
      if (r.status === "success") setEditing(false);
      return r;
    },
    initialFormState,
  );
  const [archiveState, archive, archiving] = useActionState(archiveHabitAction, initialFormState);

  return (
    <li className="grid gap-2 px-4 py-3">
      {editing ? (
        <form action={rename} className="flex gap-2">
          <input type="hidden" name="habitId" value={id} />
          <Input name="name" defaultValue={name} maxLength={60} aria-label={`Nuevo nombre para ${name}`} className="h-9 flex-1" autoFocus />
          <Button type="submit" size="sm" disabled={renaming}>
            Guardar
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancelar
          </Button>
        </form>
      ) : (
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{name}</span>
            <span className="text-muted-foreground text-xs">
              {done} de los últimos {window} días
            </span>
          </span>
          <Button type="button" variant="ghost" size="icon" aria-label={`Renombrar ${name}`} onClick={() => setEditing(true)}>
            <Pencil aria-hidden />
          </Button>
          <form action={archive}>
            <input type="hidden" name="habitId" value={id} />
            <Button type="submit" variant="ghost" size="icon" aria-label={`Archivar ${name}`} disabled={archiving}>
              <Archive aria-hidden />
            </Button>
          </form>
        </div>
      )}
      <FormMessage state={renameState.status === "error" ? renameState : archiveState.status === "error" ? archiveState : initialFormState} />
    </li>
  );
}
