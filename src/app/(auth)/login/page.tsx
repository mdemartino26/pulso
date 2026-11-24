import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { safeNextPath } from "@/lib/auth/redirect";
import { GoogleButton } from "@/features/auth/components/google-button";
import { LoginForm } from "@/features/auth/components/login-form";
import { LOGIN_URL_ERRORS, LOGIN_URL_NOTICES } from "@/features/auth/messages";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const rawNext = typeof params.next === "string" ? params.next : undefined;
  const next = rawNext ? safeNextPath(rawNext) : undefined;
  // Solo códigos conocidos: nunca se muestra texto que venga en la URL.
  const errorKey = typeof params.error === "string" ? params.error : "";
  const urlError = Object.hasOwn(LOGIN_URL_ERRORS, errorKey) ? LOGIN_URL_ERRORS[errorKey] : undefined;
  const noticeKey = typeof params.aviso === "string" ? params.aviso : "";
  const notice = Object.hasOwn(LOGIN_URL_NOTICES, noticeKey) ? LOGIN_URL_NOTICES[noticeKey] : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">¡Hola de nuevo!</CardTitle>
        <CardDescription>Entrá para ver cómo viene tu día.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        {notice ? (
          <p role="status" className="bg-primary/10 rounded-md px-3 py-2 text-sm">
            {notice}
          </p>
        ) : null}
        {urlError ? (
          <p role="alert" className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">
            {urlError}
          </p>
        ) : null}
        <GoogleButton next={next} />
        <Divider />
        <LoginForm next={next} />
        <p className="text-muted-foreground text-center text-sm">
          ¿No tenés cuenta?{" "}
          <Link href="/registro" className="text-foreground font-medium underline-offset-4 hover:underline">
            Creala acá
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

function Divider() {
  return (
    <div className="text-muted-foreground flex items-center gap-3 text-xs">
      <span className="bg-border h-px flex-1" />o con tu email
      <span className="bg-border h-px flex-1" />
    </div>
  );
}
