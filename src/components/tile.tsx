import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type TileColor = "sun" | "peach" | "lilac" | "lime" | "sky" | "rose";

const BG: Record<TileColor, string> = {
  sun: "bg-tile-sun",
  peach: "bg-tile-peach",
  lilac: "bg-tile-lilac",
  lime: "bg-tile-lime",
  sky: "bg-tile-sky",
  rose: "bg-tile-rose",
};

interface TileProps {
  color: TileColor;
  /** Título corto: se muestra en mayúsculas. */
  label: string;
  icon?: LucideIcon;
  /** Link de la esquina (ej. "ver más"). */
  href?: string;
  hrefLabel?: string;
  className?: string;
  children: ReactNode;
}

/** Tarjeta pastel del panel: título en mayúsculas, número grande y detalle chico. */
export function Tile({ color, label, icon: Icon, href, hrefLabel, className, children }: TileProps) {
  const id = `tile-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <section
      aria-labelledby={id}
      className={cn("text-tile-ink relative flex flex-col gap-3 rounded-[1.75rem] p-4 shadow-sm", BG[color], className)}
    >
      <div className="flex items-start justify-between gap-2">
        <h2 id={id} className="text-xs font-bold tracking-wider uppercase">
          {label}
        </h2>
        {href ? (
          <Link
            href={href}
            aria-label={hrefLabel ?? `Ver ${label.toLowerCase()}`}
            className="-m-1 grid size-8 place-items-center rounded-xl bg-white/45 transition-colors hover:bg-white/70"
          >
            {Icon ? <Icon aria-hidden className="size-4" strokeWidth={2} /> : null}
          </Link>
        ) : Icon ? (
          <Icon aria-hidden className="size-4" strokeWidth={2} />
        ) : null}
      </div>
      {children}
    </section>
  );
}

/** Número grande con unidad y un ícono de línea opcional a la izquierda. */
export function TileValue({ value, unit, icon: Icon }: { value: ReactNode; unit?: string; icon?: LucideIcon }) {
  return (
    <p className="flex items-center gap-2 text-4xl leading-none font-semibold tracking-tight tabular-nums">
      {Icon ? <Icon aria-hidden className="size-7 shrink-0" strokeWidth={1.75} /> : null}
      <span>
        {value}
        {unit ? <span className="ml-1 text-base font-medium">{unit}</span> : null}
      </span>
    </p>
  );
}

export function TileNote({ children, strong }: { children: ReactNode; strong?: boolean }) {
  return <p className={cn("text-xs leading-snug", strong ? "font-semibold" : "text-tile-ink-soft")}>{children}</p>;
}

/** Botón chico sobre la tarjeta (fondo blanco translúcido, texto oscuro). */
export const tileButton =
  "inline-flex h-9 items-center justify-center gap-1 rounded-xl bg-white/55 px-3 text-sm font-semibold text-tile-ink transition-colors hover:bg-white/80 disabled:opacity-60";
