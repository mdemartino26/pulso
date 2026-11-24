import { AppShell } from "@/components/shell/app-shell";

/** Pantallas privadas: todas comparten el marco con la navegación. */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return <AppShell>{children}</AppShell>;
}
