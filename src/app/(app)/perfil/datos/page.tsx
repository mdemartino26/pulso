import type { Metadata } from "next";
import { Download, FileJson, FileSpreadsheet } from "lucide-react";
import { PageHeader, pageMain, panel } from "@/components/page-header";
import { DeleteAccountForm } from "@/features/account/components/delete-account-form";
import { requireCompleteProfile } from "@/server/auth/profile-guard";
import { EXPORT_TABLES, type ExportTableName } from "@/server/services/export-service";

export const metadata: Metadata = { title: "Tus datos" };

const LABELS: Record<ExportTableName, string> = {
  perfil: "Perfil",
  pesos: "Pesos",
  metas_diarias: "Metas diarias",
  comidas: "Comidas",
  alimentos_propios: "Alimentos propios",
  actividades: "Actividades",
  series_fuerza: "Series de fuerza",
  pasos: "Pasos",
  agua: "Agua",
  sueno_y_animo: "Sueño y ánimo",
  habitos: "Hábitos",
  habitos_marcados: "Hábitos marcados",
};

const linkClass = "hover:bg-accent/60 flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-sm";

export default async function DataPage() {
  await requireCompleteProfile();
  return (
    <main className={pageMain}>
      <PageHeader title="Tus datos" subtitle="Son tuyos: podés llevártelos o borrarlos cuando quieras." back={{ href: "/perfil", label: "Perfil" }} />

      <section className={panel} aria-labelledby="exportar">
        <h2 id="exportar" className="font-medium">
          Descargar mis datos
        </h2>
        <p className="text-muted-foreground mt-1 mb-4 text-sm">
          Todo lo que registraste, para guardarlo o llevarlo a otra app. El JSON trae todo junto; los CSV se abren en Excel o Google Sheets.
        </p>
        <a href="/api/export?formato=json" download className={`${linkClass} bg-tile-sky text-tile-ink border-transparent font-semibold`}>
          <FileJson aria-hidden className="size-5" />
          <span className="flex-1">Todo en un archivo (JSON)</span>
          <Download aria-hidden className="size-4" />
        </a>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2" aria-label="Descargas en CSV">
          {EXPORT_TABLES.map((t) => (
            <li key={t}>
              <a href={`/api/export?formato=csv&tabla=${t}`} download className={linkClass}>
                <FileSpreadsheet aria-hidden className="text-muted-foreground size-4" />
                <span className="flex-1">{LABELS[t]}</span>
                <span className="text-muted-foreground text-xs">CSV</span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className={panel} aria-labelledby="borrar">
        <h2 id="borrar" className="font-medium">
          Borrar mi cuenta
        </h2>
        <div className="text-muted-foreground mt-1 mb-4 grid gap-2 text-sm">
          <p>
            Se borran tu cuenta y <strong className="text-foreground">todos</strong> tus datos: perfil, comidas, actividad, peso, agua, sueño,
            ánimo y hábitos. No se puede deshacer.
          </p>
          <p>Si querés conservarlos, descargalos antes.</p>
        </div>
        <DeleteAccountForm />
      </section>
    </main>
  );
}
