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
import { DeleteWorkspacePanel, GeneralSettings, type RosterRow } from "@/components/settings/workspace-admin";
import { AutomationRules, type RuleRow } from "@/components/settings/automation-rules";
import { SlaEditor } from "@/components/clients/sla-editor";
import { getSlaRows } from "@/lib/ticket-data";

export const metadata: Metadata = { title: "Workspace settings" };

const ACTION_LABELS: Record<string, string> = {
  "workspace.created": "created the workspace",
  "invitation.created": "invited",
  "invitation.revoked": "revoked an invitation",
  "invitation.accepted": "joined via invitation",
  "member.role_changed": "changed a member's role",
  "member.removed": "removed a member",
  "member.left": "left the workspace",
  "clients.insert": "added a client",
  "clients.update": "updated a client",
  "clients.delete": "deleted a client",
  "sla_policies.insert": "added an SLA target",
  "sla_policies.update": "changed an SLA target",
  "sla_policies.delete": "removed an SLA override",
  "automation_rules.insert": "added an automation rule",
  "automation_rules.update": "changed an automation rule",
  "automation_rules.delete": "deleted an automation rule",
  "client_technicians.insert": "assigned a technician to a client",
  "client_technicians.delete": "removed a technician from a client",
};

export default async function WorkspaceSettingsPage() {
  await requireUser();
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
  const [rosterRes, rulesRes, slaRows, auditRes] = await Promise.all([
    supabase.rpc("workspace_roster", { ws: workspace.id }),
    supabase.from("automation_rules").select("id,name,is_active,match_category,match_priority,action,target_user_id").eq("workspace_id", workspace.id).order("position"),
    getSlaRows(workspace.id),
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
        <Panel>
          <PanelHeader
            title="Team"
            description="Invite technicians and administrators, and change roles."
            action={<Button asChild variant="secondary" size="sm"><Link href="/team">Manage team</Link></Button>}
          />
        </Panel>
        <Panel>
          <PanelHeader title="SLA targets" description="Defaults for every ticket by priority. Calendar time (24×7); override them per client on the client's page. Changes apply to new tickets and to priority changes." />
          <SlaEditor rows={slaRows} clientId={null} canEdit />
        </Panel>
        <Panel>
          <PanelHeader title="Automation" description="Assign or notify automatically when tickets are created." />
          <div className="p-5">
            <AutomationRules rules={(rulesRes.data ?? []) as RuleRow[]} staff={roster.filter((r) => r.role !== "client").map((r) => ({ id: r.user_id, name: r.display_name || r.email }))} />
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Activity" description="Recent membership, client and settings changes" />
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
