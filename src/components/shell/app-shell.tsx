import Link from "next/link";
import type { ReactNode } from "react";
import { UserRound } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { BottomNav, SidebarLinks } from "./nav-links";

/**
 * Marco de la app: barra lateral tipo panel en pantallas grandes y barra de
 * abajo en el celular (las tarjetas se apilan en una o dos columnas).
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 md:gap-4 md:p-4">
      <aside className="bg-shell sticky top-4 hidden h-[calc(100dvh-2rem)] w-56 shrink-0 flex-col rounded-3xl border p-4 backdrop-blur-xl md:flex">
        <Link href="/" className="mb-6 flex items-center gap-2 px-2 text-lg font-semibold tracking-tight">
          <span aria-hidden className="bg-tile-lime text-tile-ink grid size-7 place-items-center rounded-lg text-sm">
            P
          </span>
          Pulso
        </Link>
        <nav aria-label="Secciones" className="flex-1">
          <SidebarLinks />
        </nav>
        <div className="flex items-center justify-between border-t pt-3">
          <Link
            href="/perfil"
            className="text-muted-foreground hover:text-foreground flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm"
          >
            <UserRound aria-hidden className="size-4.5" strokeWidth={1.75} />
            Perfil
          </Link>
          <ThemeToggle />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">{children}</div>
      <BottomNav />
    </div>
  );
}
