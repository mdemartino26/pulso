import { Activity, HeartPulse, LayoutGrid, ListChecks, Scale, TrendingUp, Utensils, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** En el celular solo entran 5 en la barra de abajo. */
  mobile: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Hoy", icon: LayoutGrid, mobile: true },
  { href: "/comidas", label: "Comidas", icon: Utensils, mobile: true },
  { href: "/actividad", label: "Actividad", icon: Activity, mobile: true },
  { href: "/peso", label: "Peso", icon: Scale, mobile: true },
  { href: "/tendencias", label: "Tendencias", icon: TrendingUp, mobile: true },
  { href: "/habitos", label: "Hábitos", icon: ListChecks, mobile: false },
  { href: "/bienestar", label: "Sueño y ánimo", icon: HeartPulse, mobile: false },
];

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}
