import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { RecordForm } from "@/components/knowledge/record-form";
import { requireStaff } from "@/lib/workspace";
import { getTicketDetail } from "@/lib/ticket-data";
import { first } from "@/lib/utils";

export const metadata: Metadata = { title: "New knowledge article" };

export default async function NewRecordPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const { workspace } = await requireStaff();
  const ticketId = first(sp.ticket);
  const source = ticketId ? await getTicketDetail(ticketId) : null;
  const ticket = source && source.ticket.workspace_id === workspace.id ? source.ticket : null;
  const prefill = ticket
    ? {
        title: ticket.subject,
        problem_description: ticket.description,
        solution: ticket.resolution_summary,
        status: ticket.resolution_summary ? "resolved" : "investigating",
      }
    : undefined;
  return (
    <>
      <Link href={ticket ? `/tickets/${ticket.id}` : "/knowledge"} className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> {ticket ? ticket.reference : "Knowledge base"}
      </Link>
      <PageHeader
        title="New knowledge article"
        description={ticket ? `Drafted from ${ticket.reference}. Remove anything specific to the customer before sharing it.` : "Pick a template on the right to get a head start."}
      />
      <RecordForm prefill={prefill} showVisibility={workspace.type !== "personal"} linkTicketId={ticket?.id} />
    </>
  );
}
