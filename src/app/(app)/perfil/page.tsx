import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { updateProfileAction } from "@/features/profile/actions";
import { ProfileForm } from "@/features/profile/components/profile-form";
import { requireCompleteProfile } from "@/server/auth/profile-guard";
import { timezoneOptions } from "@/server/services/profile-service";

export const metadata: Metadata = { title: "Perfil" };

export default async function ProfilePage() {
  const { overview } = await requireCompleteProfile();
  const { profile, today, weightKg } = overview;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-8 md:px-2 md:pt-2">
      <header className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/">
            <ChevronLeft aria-hidden />
            Inicio
          </Link>
        </Button>
        <ThemeToggle />
      </header>
      <h1 className="text-2xl font-semibold tracking-tight">Tu perfil</h1>
      <ProfileForm
        mode="edit"
        today={today}
        action={updateProfileAction}
        timezones={timezoneOptions(profile.timezone)}
        defaults={{
          sex: profile.sex,
          birthDate: profile.birthDate,
          heightCm: String(profile.heightCm),
          weightKg: weightKg != null ? String(weightKg).replace(".", ",") : "",
          activityLevel: profile.activityLevel,
          timezone: profile.timezone,
          goal: profile.goal,
          weeklyRateKg: String(profile.weeklyRateKg),
          waterGoalOverrideMl: profile.waterGoalOverrideMl != null ? String(profile.waterGoalOverrideMl) : "",
        }}
      />
      <footer className="border-t pt-6">
        <SignOutButton />
      </footer>
    </main>
  );
}
