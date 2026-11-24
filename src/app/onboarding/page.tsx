import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { saveOnboardingAction } from "@/features/profile/actions";
import { ProfileForm } from "@/features/profile/components/profile-form";
import { requireUser } from "@/server/auth/session";
import { getOnboardingStart, timezoneOptions } from "@/server/services/profile-service";
import { profileDeps } from "@/server/services/profile-deps";

export const metadata: Metadata = { title: "Tu perfil" };

export default async function OnboardingPage() {
  const user = await requireUser();
  const start = await getOnboardingStart(await profileDeps(), user.id);
  if (!start) redirect("/");

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-10">
      <header className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Armemos tu plan</h1>
        <p className="text-muted-foreground text-sm">
          Con estos datos estimamos cuánta energía gastás y te proponemos una meta diaria. Podés
          cambiarlos cuando quieras.
        </p>
      </header>
      <ProfileForm
        mode="onboarding"
        today={start.today}
        action={saveOnboardingAction}
        timezones={timezoneOptions(start.timezone)}
        defaults={{
          sex: "",
          birthDate: "",
          heightCm: "",
          weightKg: "",
          activityLevel: "",
          timezone: start.timezone,
          goal: "lose",
          weeklyRateKg: "0.5",
          waterGoalOverrideMl: "",
        }}
      />
    </main>
  );
}
