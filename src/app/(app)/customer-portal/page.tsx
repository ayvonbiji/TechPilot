import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { Check, MonitorSmartphone, X } from "lucide-react";
import { requireStaff, isAdminRole } from "@/lib/workspace";
import { createClient } from "@/lib/supabase/server";
import { getClients, getPeople } from "@/lib/ticket-data";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/shared/copy-button";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "Customer portal" };

async function siteUrl() {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")}://${host}`;
}

const CAN = [
  "Sign in and raise support requests for their organisation",
  "See every request from their organisation, with status and priority",
  "Reply to requests and reopen resolved ones by replying",
  "Read resolution summaries and your Public help articles",
  "Get in-app updates when you reply or change a request's status",
];
const CANNOT = [
  "See internal notes, ticket history about assignments, or SLA details",
  "See other clients' requests, people or articles",
  "Assign technicians, change priority or status, or edit requests",
  "Open staff pages, reports or workspace settings",
];

export default async function CustomerPortalPage() {
  const m = await requireStaff();
  const ws = m.workspace;
  if (ws.type === "personal") {
    return (
      <>
        <PageHeader title="Customer portal" />
        <Panel>
          <EmptyState icon={MonitorSmartphone} title="The portal is for freelance and organisation workspaces" description="Create one to give your clients a place to raise and follow requests." action={<Button asChild><Link href="/workspaces/new">New workspace</Link></Button>} />
        </Panel>
      </>
    );
  }
  const supabase = await createClient();
  const [people, clients, publicRes, portalTicketsRes] = await Promise.all([
    getPeople(ws.id),
    getClients(ws.id),
    supabase.from("troubleshooting_records").select("id", { count: "exact", head: true }).eq("workspace_id", ws.id).eq("visibility", "public"),
    supabase.from("tickets").select("requester_id,created_by").eq("workspace_id", ws.id).limit(5000),
  ]);
  const customers = people.filter((p) => p.role === "client");
  const customerIds = new Set(customers.map((c) => c.id));
  const raisedInPortal = (portalTicketsRes.data ?? []).filter((t: { created_by: string | null }) => t.created_by && customerIds.has(t.created_by)).length;
  const url = `${await siteUrl()}/portal`;

  return (
    <>
      <PageHeader title="Customer portal" description={`Where ${ws.name}'s clients raise and follow support requests.`} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] [&>*]:min-w-0">
        <Panel>
          <PanelHeader title="Portal address" description="Customers sign in with the account they created from your invitation and land in the portal automatically." />
          <PanelBody className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2">
              <code className="min-w-0 flex-1 truncate font-mono text-[13px]">{url}</code>
              <CopyButton text={url} label="Copy portal address" showLabel className="bg-surface hover:bg-border" />
            </div>
            <dl className="grid grid-cols-3 gap-4 text-center">
              <div><dt className="text-[12px] text-muted">Customer accounts</dt><dd className="text-xl font-semibold tabular-nums">{customers.length}</dd></div>
              <div><dt className="text-[12px] text-muted">Requests raised</dt><dd className="text-xl font-semibold tabular-nums">{raisedInPortal}</dd></div>
              <div><dt className="text-[12px] text-muted">Public articles</dt><dd className="text-xl font-semibold tabular-nums">{publicRes.count ?? 0}</dd></div>
            </dl>
            <p className="text-[13px] text-muted">
              The portal uses this workspace&apos;s name, logo and colour from <Link href="/settings/workspace" className="text-accent hover:underline">workspace settings</Link>. Mark articles as Public in the <Link href="/knowledge" className="text-accent hover:underline">knowledge base</Link> to show them to customers.
            </p>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader title="What customers can do" />
          <PanelBody className="space-y-4 text-sm">
            <ul className="space-y-1.5">{CAN.map((c) => <li key={c} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-ok" aria-hidden />{c}</li>)}</ul>
            <ul className="space-y-1.5">{CANNOT.map((c) => <li key={c} className="flex gap-2 text-muted"><X className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />{c}</li>)}</ul>
            <p className="text-[12px] text-subtle">These limits are enforced by the database, not just hidden in the interface.</p>
          </PanelBody>
        </Panel>

        <Panel className="lg:col-span-2">
          <PanelHeader title="Access by client" description={isAdminRole(m.role) ? "Invite people from a client's page." : "Workspace admins can invite customers from a client's page."} />
          {clients.length ? (
            <ul className="divide-y divide-border">
              {clients.map((c) => {
                const n = customers.filter((p) => p.clientId === c.id);
                return (
                  <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm">
                    <Link href={`/clients/${c.id}`} className="min-w-0 flex-1 font-medium hover:text-accent">{c.name}{!c.is_active && <span className="ml-2 text-[12px] font-normal text-muted">(inactive)</span>}</Link>
                    <span className="text-muted">{n.length ? n.map((p) => p.name).join(", ") : "No portal accounts"}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-5 py-4 text-sm text-muted">Add a client first, then invite its staff.</p>
          )}
        </Panel>
      </div>
    </>
  );
}
