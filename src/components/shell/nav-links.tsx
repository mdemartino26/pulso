"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, isActive } from "./nav-items";

/** Navegación de la barra lateral (compu y tablet). */
export function SidebarLinks() {
  const pathname = usePathname();
  return (
    <ul className="grid gap-1">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
                active ? "bg-accent text-foreground font-medium" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
              )}
            >
              <Icon aria-hidden className="size-4.5" strokeWidth={1.75} />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Barra de abajo en el celular: al alcance del pulgar. */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Secciones"
      className="bg-shell fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {NAV_ITEMS.filter((i) => i.mobile).map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2 text-[11px]",
                  active ? "text-foreground font-medium" : "text-muted-foreground",
                )}
              >
                <span className={cn("grid h-7 w-12 place-items-center rounded-full", active && "bg-accent")}>
                  <Icon aria-hidden className="size-5" strokeWidth={1.75} />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
