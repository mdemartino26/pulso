import "server-only";
import { redirect } from "next/navigation";
import { getProfileOverview } from "@/server/services/profile-service";
import { profileDeps } from "@/server/services/profile-deps";
import { requireUser } from "./session";

/**
 * Para pantallas que necesitan el perfil completo (todas salvo el
 * onboarding). Si falta completar el onboarding, manda ahí.
 */
export async function requireCompleteProfile() {
  const user = await requireUser();
  const overview = await getProfileOverview(await profileDeps(), user.id);
  if (!overview) redirect("/onboarding");
  return { user, overview };
}
