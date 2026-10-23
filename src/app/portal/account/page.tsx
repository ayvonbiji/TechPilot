import type { Metadata } from "next";
import { getProfile, requireUser } from "@/lib/auth";
import { getCurrentMembership } from "@/lib/workspace";
import { AccountPanel, CurrentWorkspacePanel, PasswordForm, ProfileForm } from "@/components/settings/settings-forms";

export const metadata: Metadata = { title: "Account" };

export default async function PortalAccountPage() {
  const user = await requireUser();
  const profile = await getProfile();
  const m = await getCurrentMembership();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-[1.6rem] font-semibold leading-tight">Your account</h1>
      <ProfileForm profile={profile} email={user.email} />
      <PasswordForm />
      <CurrentWorkspacePanel name={m.workspace.name} typeLabel="Support portal" roleLabel="Customer" canLeave />
      <AccountPanel />
    </div>
  );
}
