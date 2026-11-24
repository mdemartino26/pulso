import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GoogleButton } from "@/features/auth/components/google-button";
import { RegisterForm } from "@/features/auth/components/register-form";

export const metadata: Metadata = { title: "Crear cuenta" };

export default function RegisterPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Creá tu cuenta</CardTitle>
        <CardDescription>Te lleva menos de un minuto.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <GoogleButton />
        <div className="text-muted-foreground flex items-center gap-3 text-xs">
          <span className="bg-border h-px flex-1" />o con tu email
          <span className="bg-border h-px flex-1" />
        </div>
        <RegisterForm />
        <p className="text-muted-foreground text-center text-sm">
          ¿Ya tenés cuenta?{" "}
          <Link href="/login" className="text-foreground font-medium underline-offset-4 hover:underline">
            Entrá
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
