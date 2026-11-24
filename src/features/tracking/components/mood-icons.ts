import { Annoyed, Frown, Laugh, Meh, Smile, type LucideIcon } from "lucide-react";

/** Íconos de línea para el ánimo (1 a 5). Archivo sin "use client": lo usan pantallas de servidor y del cliente. */
export const MOOD_ICONS: Record<number, LucideIcon> = { 1: Frown, 2: Annoyed, 3: Meh, 4: Smile, 5: Laugh };
