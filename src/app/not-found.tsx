import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-semibold">No encontramos esa página</h1>
      <p className="text-muted-foreground text-sm">Puede que el link esté mal o que la página ya no exista.</p>
      <Link href="/" className={buttonVariants()}>
        Ir al inicio
      </Link>
    </main>
  );
}
