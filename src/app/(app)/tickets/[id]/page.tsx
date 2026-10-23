import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, RotateCcw } from "lucide-react";
import { getProfile, requireUser } from "@/lib/auth";
import { isAdminRole, requireStaff } from "@/lib/workspace";
import { getClients, getPeople, getTicketDetail } from "@/lib/ticket-data";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/dates";
import { Panel } from "@/components/ui/card";
import { Markdown } from "@/components/shared/markdown";
import { TicketPriorityLabel, TicketStatusLabel } from "@/components/tickets/ticket-badges";
import { TicketTimeline } from "@/components/tickets/ticket-timeline";
import { ReplyComposer } from "@/components/tickets/reply-composer";
import { TicketSidebar } from "@/components/tickets/ticket-sidebar";

export const metadata: Metadata = { title: "Ticket" };

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const m = await requireStaff();
  const profile = await getProfile();
  const detail = await getTicketDetail(id);
  // RLS already hides other workspaces' tickets; also keep the view inside the current workspace.
  if (!detail || detail.ticket.workspace_id !== m.workspace.id) notFound();
  const { ticket, comments, events } = detail;

  const supabase = await createClient();
  const [people, clients, articlesRes] = await Promise.all([
    getPeople(m.workspace.id),
    getClients(m.workspace.id),
    supabase.from("troubleshooting_records").select("id,title").eq("workspace_id", m.workspace.id).order("title").limit(500),
  ]);
  const articles = ((articlesRes.data ?? []) as { id: string; title: string }[]).map((a) => ({ id: a.id, name: a.title }));
  const staff = people.filter((p) => p.role !== "client").map((p) => ({ id: p.id, name: p.name }));
  const requesterOptions = people
    .filter((p) => p.role === "client" && (!ticket.client_id || p.clientId === ticket.client_id))
    .map((p) => ({ id: p.id, name: p.name, email: p.email }));
  const fmt = { tz: profile.timezone, dateFormat: profile.date_format, timeFormat: profile.time_format };
  const stamps = [ticket.first_response_due_at, ticket.resolution_due_at, ticket.first_responded_at, ticket.resolved_at, ticket.closed_at].filter(Boolean) as string[];
  const fmtTimes = Object.fromEntries(stamps.map((s) => [s, formatDateTime(s, fmt)]));
  const lookup = {
    names: Object.fromEntries(people.map((p) => [p.id, p.name])),
    clients: Object.fromEntries(clients.map((c) => [c.id, c.name])),
    articles: Object.fromEntries(articles.map((a) => [a.id, a.name])),
  };
  const client = ticket.client_id ? lookup.clients[ticket.client_id] : null;

  return (
    <div>
      <Link href="/tickets" className="no-print mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Tickets
      </Link>
      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px]">
          <span className="font-mono text-muted">{ticket.reference}</span>
          <TicketStatusLabel status={ticket.status} />
          <TicketPriorityLabel priority={ticket.priority} />
          {client && <span className="text-muted">{client}</span>}
          {ticket.reopened_count > 0 && (
            <span className="inline-flex items-center gap-1 text-muted">
              <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Reopened {ticket.reopened_count}×
            </span>
          )}
        </div>
        <h1 className="mt-2 text-[1.6rem] font-semibold leading-tight tracking-[-0.01em]">{ticket.subject}</h1>
        <p className="mt-1 text-[13px] text-subtle">
          Opened {formatDateTime(ticket.created_at, fmt)}
          {ticket.requester_name ? ` by ${ticket.requester_name}` : ""}, updated {formatDateTime(ticket.updated_at, fmt)}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] [&>*]:min-w-0">
        <div className="space-y-6">
          <Panel className="px-5 py-4">
            <h2 className="sr-only">Description</h2>
            {ticket.description.trim() ? <Markdown breaks className="text-sm">{ticket.description}</Markdown> : <p className="text-sm text-muted">No description.</p>}
          </Panel>

          {(ticket.status === "resolved" || ticket.status === "closed") && ticket.resolution_summary && (
            <Panel className="border-ok/40 bg-ok-soft px-5 py-4">
              <h2 className="text-sm font-semibold text-ok">Resolution</h2>
              <Markdown breaks className="mt-1.5 text-sm">{ticket.resolution_summary}</Markdown>
            </Panel>
          )}

          <section aria-labelledby="conversation">
            <h2 id="conversation" className="mb-3 text-[15px] font-semibold">Conversation and history</h2>
            <TicketTimeline comments={comments} events={events} lookup={lookup} fmt={fmt} viewer="staff" />
          </section>

          <div className="no-print">
            <ReplyComposer ticketId={ticket.id} status={ticket.status} mode="staff" isAdmin={isAdminRole(m.role)} />
          </div>
        </div>

        <div className="no-print">
          <TicketSidebar
            ticket={ticket}
            isAdmin={isAdminRole(m.role)}
            meId={user.id}
            staff={staff}
            clients={clients.filter((c) => c.is_active || c.id === ticket.client_id).map((c) => ({ id: c.id, name: c.name }))}
            articles={articles}
            requesterOptions={requesterOptions}
            fmtTimes={fmtTimes}
          />
        </div>
      </div>
    </div>
  );
}
