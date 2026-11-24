import "server-only";
import { RepositoryError } from "./types";

/*
 * Supabase devuelve como máximo 1000 filas por consulta (max_rows). Para
 * lecturas que pueden pasar ese número, se pide por páginas con `.range()`.
 */

const PAGE = 1000;

type Page<T> = PromiseLike<{ data: T[] | null; error: { code?: string } | null }>;

export async function fetchAllPages<T>(label: string, page: (from: number, to: number) => Page<T>, maxRows = 200_000): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < maxRows; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new RepositoryError(label, error);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}
