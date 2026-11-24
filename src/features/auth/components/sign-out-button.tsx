import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOutAction } from "../actions";

/** Formulario (POST) y no link: cerrar sesión no debe poder dispararse con un GET. */
export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <Button type="submit" variant="ghost" size="sm">
        <LogOut aria-hidden />
        Cerrar sesión
      </Button>
    </form>
  );
}
