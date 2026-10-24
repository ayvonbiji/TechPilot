import type { Metadata } from "next";
import Link from "next/link";
import { Inbox, Plus } from "lucide-react";
import { getProfile, requireUser } from "@/lib/auth";
import { getCurrentMembership } from "@/lib/workspace";
import { listTickets } from "@/lib/ticket-data";
import { formatDateTime } from "@/lib/dates";
import { first } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { TicketPriorityLabel, TicketStatusLabel } from "@/components/tickets/ticket-badges";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Support requests" };

const TABS = [
  { key: "active", label: "Open" },
  { key: "resolved", label: "Resolved" },
  { key: "closed", label: "Closed" },
  { key: "all", label: "All" },
];

export default async function PortalHome({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const m = await getCurrentMembership();
  const profile = await getProfile();
  const status = TABS.some((t) => t.key === first(sp.status)) ? first(sp.status)! : "active";
  const q = first(sp.q);
  // RLS returns only this customer's organisation's tickets.
  const { tickets, total, page, error } = await listTickets(m.workspace.id, user.id, { status, q, page: Number(first(sp.page)) || 1, pageSize: 20 });
  const fmt = { tz: profile.timezone, dateFormat: profile.date_format, timeFormat: profile.time_format };

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[1.6rem] font-semibold leading-tight">Support requests</h1>
          <p className="mt-1 text-sm text-muted">Requests from your organisation and their progress.</p>
        </div>
        <Button asChild><Link href="/portal/new"><Plus /> New request</Link></Button>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav className="flex gap-1" aria-label="Filter by status">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={t.key === "active" ? "/portal" : `/portal?status=${t.key}`}
              aria-current={status === t.key ? "page" : undefined}
              className={cn("rounded-lg px-3 py-1.5 text-[13px] font-medium", status === t.key ? "bg-accent text-white" : "text-muted hover:bg-surface-2 hover:text-foreground")}
            >
              {t.label}
            </Link>
          ))}
        </nav>
        <form action="/portal" className="flex gap-2">
          {status !== "active" && <input type="hidden" name="status" value={status} />}
          <label htmlFor="portal-q" className="sr-only">Search requests</label>
          <input id="portal-q" name="q" defaultValue={q} placeholder="Search requests" maxLength={100} className="h-9 w-full rounded-lg border border-border-strong bg-surface px-3 text-sm sm:w-56" />
        </form>
      </div>

      {error && <p role="alert" className="mb-4 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger">Requests couldn&apos;t be loaded. Refresh to try again.</p>}

      <Panel>
        {tickets.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={status === "active" && !q ? "No open requests" : "Nothing found"}
            description={status === "active" && !q ? "When something isn't working, raise a request and the support team will pick it up." : "Try another tab or search."}
            action={status === "active" && !q ? <Button asChild><Link href="/portal/new"><Plus /> New request</Link></Button> : undefined}
          />
        ) : (
          <>
            <ul className="divide-y divide-border">
              {tickets.map((t) => (
                <li key={t.id}>
                  <Link href={`/portal/tickets/${t.id}`} className="flex flex-col gap-1.5 px-5 py-3.5 hover:bg-surface-2 sm:flex-row sm:items-center sm:gap-4">
                    <span className="w-24 shrink-0 font-mono text-[12px] text-muted">{t.reference}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{t.subject}</span>
                      <span className="text-[12px] text-muted">
                        {t.requester_name ? `${t.requester_name}, ` : ""}opened {formatDateTime(t.created_at, fmt)}
                      </span>
                    </span>
                    <span className="flex items-center gap-3">
                      <TicketPriorityLabel priority={t.priority} />
                      <TicketStatusLabel status={t.status} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="border-t border-border px-4">
              <Pagination page={page} pageSize={20} total={total} basePath="/portal" params={{ status: status === "active" ? undefined : status, q }} />
            </div>
          </>
        )}
      </Panel>
    </>
  );
}
