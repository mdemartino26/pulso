import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Encabezado de las pantallas internas: volver (opcional), título y acciones. */
export function PageHeader({
  title,
  subtitle,
  back,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  back?: { href: string; label: string };
  actions?: ReactNode;
}) {
  return (
    <header className="grid gap-2">
      {back || actions ? (
        <div className="flex items-center justify-between">
          {back ? (
            <Button asChild variant="ghost" size="sm" className="-ml-2">
              <Link href={back.href}>
                <ChevronLeft aria-hidden />
                {back.label}
              </Link>
            </Button>
          ) : (
            <span />
          )}
          {actions}
        </div>
      ) : null}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? <p className="text-muted-foreground text-sm">{subtitle}</p> : null}
      </div>
    </header>
  );
}

/** Contenedor de página: una columna cómoda en el celular, más ancho en la compu. */
export const pageMain =
  "mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-8 md:px-2 md:pt-2";

/** Panel tipo vidrio para listas y formularios. */
export const panel = "bg-card rounded-3xl border p-4 backdrop-blur-xl";
