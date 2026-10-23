import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { requireStaff } from "@/lib/workspace";
import { getClients, getPeople } from "@/lib/ticket-data";
import { first } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { NewTicketForm } from "@/components/tickets/new-ticket-form";

export const metadata: Metadata = { title: "New ticket" };

export default async function NewTicketPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const { workspace } = await requireStaff();
  const [people, clients] = await Promise.all([getPeople(workspace.id), getClients(workspace.id)]);
  const active = clients.filter((c) => c.is_active);
  const wanted = first(sp.client);
  return (
    <>
      <Link href="/tickets" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Tickets
      </Link>
      <PageHeader title="New ticket" description="The ticket number is assigned when you save." />
      <NewTicketForm
        people={people}
        clients={active}
        meId={user.id}
        defaultClient={active.some((c) => c.id === wanted) ? wanted : undefined}
      />
    </>
  );
}
