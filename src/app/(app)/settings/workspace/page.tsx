import type { Metadata } from "next";
import { requireUser, getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceAdmin, TYPE_LABELS } from "@/lib/workspace";
import { formatDateTime } from "@/lib/dates";
import { Panel, PanelHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Building2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DeleteWorkspacePanel,
  GeneralSettings,
  InvitePanel,
  MembersPanel,
  type PendingInvite,
  type RosterRow,
} from "@/components/settings/workspace-admin";

export const metadata: Metadata = { title: "Workspace settings" };

const ACTION_LABELS: Record<string, string> = {
  "workspace.created": "created the workspace",
  "invitation.created": "invited",
  "invitation.revoked": "revoked an invitation",
  "invitation.accepted": "joined via invitation",
  "member.role_changed": "changed a member's role",
  "member.removed": "removed a member",
  "member.left": "left the workspace",
};

export default async function WorkspaceSettingsPage() {
  const user = await requireUser();
  const profile = await getProfile();
  const { workspace, role } = await requireWorkspaceAdmin();

  if (workspace.type === "personal") {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Workspace settings" />
        <Panel>
          <EmptyState
            icon={Building2}
            title="Your personal workspace is just for you"
            description="To work with technicians or clients, create a freelance or organisation workspace."
            action={<Button asChild><Link href="/workspaces/new">New workspace</Link></Button>}
          />
        </Panel>
      </div>
    );
  }

  const supabase = await createClient();
  const [rosterRes, invitesRes, auditRes] = await Promise.all([
    supabase.rpc("workspace_roster", { ws: workspace.id }),
    supabase
      .from("invitations")
      .select("id,email,role,expires_at,created_at")
      .eq("workspace_id", workspace.id)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }),
    supabase.from("audit_log").select("id,action,details,created_at,actor_id").eq("workspace_id", workspace.id).order("created_at", { ascending: false }).limit(25),
  ]);
  const roster = (rosterRes.data ?? []) as RosterRow[];
  const names = new Map(roster.map((r) => [r.user_id, r.display_name || r.email]));
  const fmt = { tz: profile.timezone, dateFormat: profile.date_format, timeFormat: profile.time_format };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Workspace settings" description={`${workspace.name}, ${TYPE_LABELS[workspace.type].toLowerCase()} workspace`} />
      <div className="space-y-6">
        <GeneralSettings ws={workspace} />
        <InvitePanel myRole={role} pendingInvites={(invitesRes.data ?? []) as PendingInvite[]} />
        <MembersPanel roster={roster} me={user.id} myRole={role} />
        <Panel>
          <PanelHeader title="Activity" description="Recent membership and settings changes" />
          {(auditRes.data ?? []).length ? (
            <ul className="divide-y divide-border">
              {(auditRes.data ?? []).map((a: { id: number; action: string; details: Record<string, string>; created_at: string; actor_id: string | null }) => (
                <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-2.5 text-sm">
                  <span>
                    <span className="font-medium">{(a.actor_id && names.get(a.actor_id)) || "A former member"}</span>{" "}
                    {ACTION_LABELS[a.action] ?? a.action}
                    {a.action === "invitation.created" && a.details?.email ? ` ${a.details.email}` : ""}
                    {a.action === "member.role_changed" && a.details?.to ? ` to ${a.details.to}` : ""}
                  </span>
                  <span className="text-[12px] text-muted">{formatDateTime(a.created_at, fmt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-4 text-sm text-muted">No activity yet.</p>
          )}
        </Panel>
        {role === "owner" && <DeleteWorkspacePanel name={workspace.name} />}
      </div>
    </div>
  );
}
