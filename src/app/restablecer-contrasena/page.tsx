import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";
import { requireUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Nueva contraseña" };

/** Se llega desde el link del mail (que ya inició la sesión de recuperación). */
export default async function ResetPasswordPage() {
  await requireUser();
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Elegí una contraseña nueva</CardTitle>
          <CardDescription>Después vas directo a tu día.</CardDescription>
        </CardHeader>
        <CardContent>
          <ResetPasswordForm />
        </CardContent>
      </Card>
    </main>
  );
}
