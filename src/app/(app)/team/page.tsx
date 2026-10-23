import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceAdmin } from "@/lib/workspace";
import { ACTIVE_STATUSES } from "@/lib/tickets";
import { Panel, PanelHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { InvitePanel, MembersPanel, type PendingInvite, type RosterRow } from "@/components/settings/workspace-admin";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  const user = await requireUser();
  const { workspace, role } = await requireWorkspaceAdmin();
  if (workspace.type === "personal") {
    return (
      <>
        <PageHeader title="Team" />
        <Panel>
          <EmptyState icon={Users} title="Your personal workspace is just for you" description="Create a freelance or organisation workspace to work with technicians." action={<Button asChild><Link href="/workspaces/new">New workspace</Link></Button>} />
        </Panel>
      </>
    );
  }
  const supabase = await createClient();
  const [rosterRes, invitesRes, loadRes] = await Promise.all([
    supabase.rpc("workspace_roster", { ws: workspace.id }),
    supabase
      .from("invitations")
      .select("id,email,role,expires_at,created_at")
      .eq("workspace_id", workspace.id)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .neq("role", "client")
      .order("created_at", { ascending: false }),
    supabase.from("tickets").select("assignee_id").eq("workspace_id", workspace.id).in("status", ACTIVE_STATUSES).not("assignee_id", "is", null).limit(5000),
  ]);
  const roster = (rosterRes.data ?? []) as RosterRow[];
  const staff = roster.filter((r) => r.role !== "client");
  const load = new Map<string, number>();
  (loadRes.data ?? []).forEach((t: { assignee_id: string }) => load.set(t.assignee_id, (load.get(t.assignee_id) ?? 0) + 1));

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Team" description={`Technicians and administrators in ${workspace.name}. Customer accounts are managed from each client's page.`} />
      <div className="space-y-6">
        <InvitePanel myRole={role} pendingInvites={(invitesRes.data ?? []) as PendingInvite[]} />
        <MembersPanel roster={staff} me={user.id} myRole={role} />
        <Panel>
          <PanelHeader title="Current workload" description="Active tickets assigned to each person" />
          <ul className="divide-y divide-border">
            {staff.map((s) => (
              <li key={s.user_id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                <span>{s.display_name || s.email}</span>
                <Link href={`/tickets?assignee=${s.user_id}`} className="tabular-nums text-muted hover:text-accent">{load.get(s.user_id) ?? 0} active</Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
