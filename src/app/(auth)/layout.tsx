import { ThemeToggle } from "@/components/theme-toggle";

/** Marco de las pantallas de acceso: centrado, una columna, pensado para el celular. */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-8">
      <header className="flex items-center justify-between">
        <span className="text-xl font-semibold tracking-tight">Pulso</span>
        <ThemeToggle />
      </header>
      <div className="flex flex-1 flex-col justify-center">{children}</div>
    </main>
  );
}
