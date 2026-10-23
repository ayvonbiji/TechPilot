import type { Metadata } from "next";
import { getProfile, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { AccountPanel, CurrentWorkspacePanel, DataPanel, DemoDataPanel, PasswordForm, ProfileForm } from "@/components/settings/settings-forms";
import { getCurrentMembership, ROLE_LABELS, TYPE_LABELS } from "@/lib/workspace";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const profile = await getProfile();
  const current = await getCurrentMembership();
  const supabase = await createClient();
  const checks = await Promise.all(
    ["tasks", "troubleshooting_records", "notes", "work_logs", "skills"].map((t) =>
      supabase.from(t).select("id", { count: "exact", head: true }).eq("is_demo", true),
    ),
  );
  const hasDemo = checks.some((c) => (c.count ?? 0) > 0);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Settings" />
      <div className="space-y-6">
        <ProfileForm profile={profile} email={user.email} />
        <CurrentWorkspacePanel
          name={current.workspace.name}
          typeLabel={TYPE_LABELS[current.workspace.type]}
          roleLabel={ROLE_LABELS[current.role]}
          canLeave={current.workspace.type !== "personal"}
        />
        <PasswordForm />
        <DemoDataPanel hasDemo={hasDemo} />
        <DataPanel />
        <AccountPanel />
      </div>
    </div>
  );
}
