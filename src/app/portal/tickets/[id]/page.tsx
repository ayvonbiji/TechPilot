import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getProfile } from "@/lib/auth";
import { getCurrentMembership } from "@/lib/workspace";
import { getMemberNames, getTicketDetail } from "@/lib/ticket-data";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/dates";
import { Panel } from "@/components/ui/card";
import { Markdown } from "@/components/shared/markdown";
import { TicketPriorityLabel, TicketStatusLabel } from "@/components/tickets/ticket-badges";
import { TicketTimeline } from "@/components/tickets/ticket-timeline";
import { ReplyComposer } from "@/components/tickets/reply-composer";

export const metadata: Metadata = { title: "Request" };

export default async function PortalTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await getCurrentMembership();
  const profile = await getProfile();
  // RLS returns the ticket only if it belongs to this customer's organisation,
  // and returns public replies and public history only.
  const detail = await getTicketDetail(id);
  if (!detail || detail.ticket.workspace_id !== m.workspace.id) notFound();
  const { ticket, comments, events } = detail;
  const names = await getMemberNames(m.workspace.id);
  const supabase = await createClient();
  const { data: article } = ticket.kb_article_id
    ? await supabase.from("troubleshooting_records").select("id,title").eq("id", ticket.kb_article_id).maybeSingle()
    : { data: null };
  const fmt = { tz: profile.timezone, dateFormat: profile.date_format, timeFormat: profile.time_format };

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/portal" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> My requests
      </Link>
      <header className="mb-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px]">
          <span className="font-mono text-muted">{ticket.reference}</span>
          <TicketStatusLabel status={ticket.status} />
          <TicketPriorityLabel priority={ticket.priority} />
        </div>
        <h1 className="mt-2 text-[1.5rem] font-semibold leading-tight">{ticket.subject}</h1>
        <p className="mt-1 text-[13px] text-subtle">
          Opened {formatDateTime(ticket.created_at, fmt)}
          {ticket.requester_name ? ` by ${ticket.requester_name}` : ""}
          {ticket.assignee_id && names.get(ticket.assignee_id) ? `. Handled by ${names.get(ticket.assignee_id)}` : ""}
        </p>
      </header>

      <div className="space-y-5">
        <Panel className="px-5 py-4">
          {ticket.description.trim() ? <Markdown breaks className="text-sm">{ticket.description}</Markdown> : <p className="text-sm text-muted">No description.</p>}
        </Panel>

        {(ticket.status === "resolved" || ticket.status === "closed") && ticket.resolution_summary && (
          <Panel className="border-ok/40 bg-ok-soft px-5 py-4">
            <h2 className="text-sm font-semibold text-ok">How this was resolved</h2>
            <Markdown breaks className="mt-1.5 text-sm">{ticket.resolution_summary}</Markdown>
            {article && (
              <p className="mt-2 text-[13px]">
                Related help article: <Link href={`/portal/knowledge/${article.id}`} className="text-accent hover:underline">{article.title}</Link>
              </p>
            )}
            {ticket.status === "resolved" && <p className="mt-2 text-[12px] text-muted">Still having trouble? Reply below and the request will be reopened.</p>}
          </Panel>
        )}

        <section aria-labelledby="conv">
          <h2 id="conv" className="mb-3 text-[15px] font-semibold">Conversation</h2>
          <TicketTimeline comments={comments} events={events} lookup={{ names: Object.fromEntries(names), clients: {}, articles: {} }} fmt={fmt} viewer="customer" />
        </section>

        <ReplyComposer
          ticketId={ticket.id}
          status={ticket.status}
          mode="customer"
          disabledReason={ticket.status === "closed" ? "This request is closed. If the problem comes back, please raise a new request." : undefined}
        />
      </div>
    </div>
  );
}
