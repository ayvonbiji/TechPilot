import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Plus } from "lucide-react";
import { getProfile } from "@/lib/auth";
import { isAdminRole, requireStaff } from "@/lib/workspace";
import { createClient } from "@/lib/supabase/server";
import { getPeople, getSlaRows } from "@/lib/ticket-data";
import { formatDateTime, isoDaysAgo } from "@/lib/dates";
import type { Ticket } from "@/lib/tickets";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EditClientForm } from "@/components/clients/client-form";
import { ActiveToggle, CustomerInvite, TechniciansEditor } from "@/components/clients/client-admin";
import { SlaEditor } from "@/components/clients/sla-editor";
import { SlaChip, TicketStatusLabel } from "@/components/tickets/ticket-badges";

export const metadata: Metadata = { title: "Client" };

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const m = await requireStaff();
  const profile = await getProfile();
  const supabase = await createClient();
  const { data: client } = await supabase.from("clients").select("*").eq("id", id).eq("workspace_id", m.workspace.id).maybeSingle();
  if (!client) notFound();
  const admin = isAdminRole(m.role);

  const since = isoDaysAgo(30);
  const [people, techRes, ticketsRes, resolvedRes, slaRows] = await Promise.all([
    getPeople(m.workspace.id),
    supabase.from("client_technicians").select("user_id").eq("client_id", id),
    supabase.from("tickets").select("*").eq("client_id", id).order("created_at", { ascending: false }).limit(8),
    supabase.from("tickets").select("id", { count: "exact", head: true }).eq("client_id", id).gte("resolved_at", since),
    getSlaRows(m.workspace.id, id),
  ]);
  const staff = people.filter((p) => p.role !== "client").map((p) => ({ id: p.id, name: p.name }));
  const assignedIds = new Set((techRes.data ?? []).map((t: { user_id: string }) => t.user_id));
  const assigned = staff.filter((s) => assignedIds.has(s.id));
  const customers = people.filter((p) => p.role === "client" && p.clientId === id);
  const tickets = (ticketsRes.data ?? []) as Ticket[];
  const { count: openCount } = await supabase
    .from("tickets")
    .select("id", { count: "exact", head: true })
    .eq("client_id", id)
    .in("status", ["open", "in_progress", "waiting_customer", "waiting_third_party"]);
  const fmt = { tz: profile.timezone, dateFormat: profile.date_format, timeFormat: profile.time_format };

  return (
    <div>
      <Link href="/clients" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Clients
      </Link>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[1.6rem] font-semibold leading-tight tracking-[-0.01em]">{client.name}</h1>
            {!client.is_active && <Badge>Inactive</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted">
            {openCount ?? 0} open ticket{openCount === 1 ? "" : "s"}, {resolvedRes.count ?? 0} resolved in the last 30 days. Client since {formatDateTime(client.created_at, fmt).split(",")[0]}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {client.is_active && <Button asChild><Link href={`/tickets/new?client=${id}`}><Plus /> New ticket</Link></Button>}
          <Button asChild variant="secondary"><Link href={`/service-reports?client=${id}`}>Reports</Link></Button>
          <ActiveToggle id={id} active={client.is_active} name={client.name} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] [&>*]:min-w-0">
        <Panel className="lg:col-span-2">
          <PanelHeader
            title="Recent tickets"
            action={<Button asChild variant="ghost" size="sm"><Link href={`/tickets?client=${id}&status=all`}>All tickets</Link></Button>}
          />
          {tickets.length ? (
            <ul className="divide-y divide-border">
              {tickets.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-2.5 text-sm">
                  <span className="w-20 font-mono text-[12px] text-muted">{t.reference}</span>
                  <Link href={`/tickets/${t.id}`} className="min-w-0 flex-1 truncate font-medium hover:text-accent">{t.subject}</Link>
                  <TicketStatusLabel status={t.status} />
                  <SlaChip ticket={t} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-4 text-sm text-muted">No tickets for this client yet.</p>
          )}
        </Panel>

        <Panel>
          <PanelHeader title="Details" />
          <PanelBody>
            <EditClientForm
              id={id}
              initial={{
                name: client.name,
                email: client.email,
                phone: client.phone,
                address: client.address,
                primary_contact_name: client.primary_contact_name,
                primary_contact_email: client.primary_contact_email,
                service_notes: client.service_notes,
                notes: client.notes,
              }}
            />
          </PanelBody>
        </Panel>

        <div className="space-y-6">
          <Panel>
            <PanelHeader title="Customer portal accounts" description="People from this organisation who can raise and follow tickets." />
            <PanelBody className="space-y-4">
              {customers.length ? (
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {customers.map((c) => (
                    <li key={c.id} className="px-3 py-2 text-sm">
                      <span className="font-medium">{c.name}</span>
                      <span className="block text-[12px] text-muted">{c.email}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">No one from this organisation has a portal account yet.</p>
              )}
              {admin ? <CustomerInvite clientId={id} /> : <p className="text-[12px] text-muted">Workspace admins can invite customers.</p>}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="Assigned technicians" description="Notified about this client's new and unassigned tickets." />
            <PanelBody>
              <TechniciansEditor clientId={id} assigned={assigned} staff={staff} canEdit={admin} />
            </PanelBody>
          </Panel>
        </div>

        <Panel className="lg:col-span-2">
          <PanelHeader title="SLA targets" description="Calendar-time targets. Overrides apply only to this client; other priorities use the workspace defaults." />
          <SlaEditor rows={slaRows} clientId={id} canEdit={admin} />
        </Panel>
      </div>
    </div>
  );
}
