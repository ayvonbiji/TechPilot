import type { Metadata } from "next";
import Link from "next/link";
import { Columns3, Inbox, List, Plus } from "lucide-react";
import { requireStaff, isAdminRole } from "@/lib/workspace";
import { getClients, getPeople, listTickets, sweepSla } from "@/lib/ticket-data";
import { TICKET_PRIORITIES, TICKET_STATUSES, type Ticket } from "@/lib/tickets";
import { getProfile, requireUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/dates";
import { first, sanitizeSearch } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { FilterBar } from "@/components/shared/filter-bar";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { SlaChip, TicketPriorityLabel, TicketStatusLabel } from "@/components/tickets/ticket-badges";
import { TicketBoard } from "@/components/tickets/ticket-board";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Tickets" };

type SP = Promise<Record<string, string | string[] | undefined>>;

const VIEWS = [
  { key: "active", label: "Active", params: {} },
  { key: "mine", label: "Assigned to me", params: { assignee: "me" } },
  { key: "unassigned", label: "Unassigned", params: { assignee: "unassigned" } },
  { key: "at_risk", label: "Due soon", params: { sla: "at_risk" } },
  { key: "breached", label: "Overdue", params: { sla: "breached" } },
  { key: "all", label: "All tickets", params: { status: "all" } },
] as const;

export default async function TicketsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const user = await requireUser();
  const m = await requireStaff();
  const profile = await getProfile();
  const ws = m.workspace;
  const p = {
    q: first(sp.q),
    status: first(sp.status),
    priority: first(sp.priority),
    client: first(sp.client),
    assignee: first(sp.assignee),
    sla: first(sp.sla),
    sort: first(sp.sort),
    view: first(sp.view),
    page: first(sp.page),
  };
  const board = p.view === "board";

  await sweepSla(ws.id);
  const [people, clients] = await Promise.all([getPeople(ws.id), getClients(ws.id)]);
  const staff = people.filter((x) => x.role !== "client");
  const names = Object.fromEntries(people.map((x) => [x.id, x.name]));
  const clientNames = Object.fromEntries(clients.map((c) => [c.id, c.name]));

  const filters = {
    q: p.q,
    status: p.status,
    priority: p.priority,
    client: p.client,
    assignee: p.assignee,
    sla: p.sla,
    sort: p.sort,
    page: Number(p.page) || 1,
  };

  let tickets: Ticket[] = [];
  let total = 0;
  let page = 1;
  let loadError = false;
  let closedShown = 0;
  if (board) {
    // Board: every open-to-resolved ticket matching the filters, plus recently closed ones.
    const base = await listTickets(ws.id, user.id, { ...filters, status: "all", sort: "created", pageSize: 2000, page: 1 });
    loadError = base.error;
    const live = base.tickets.filter((t) => t.status !== "closed");
    const closed = base.tickets.filter((t) => t.status === "closed").sort((a, b) => (b.closed_at ?? "").localeCompare(a.closed_at ?? "")).slice(0, 20);
    closedShown = closed.length;
    tickets = [...live, ...closed];
  } else {
    const res = await listTickets(ws.id, user.id, filters);
    tickets = res.tickets;
    total = res.total;
    page = res.page;
    loadError = res.error;
  }

  const activeView =
    VIEWS.find((v) => {
      const vp = v.params as Record<string, string>;
      return (["assignee", "sla", "status"] as const).every((k) => (vp[k] ?? undefined) === (p[k] ?? undefined));
    })?.key ?? null;
  const viewHref = (params: Record<string, string>) => {
    const q = new URLSearchParams(params);
    if (board) q.set("view", "board");
    const s = q.toString();
    return s ? `/tickets?${s}` : "/tickets";
  };
  const toggleHref = (() => {
    const q = new URLSearchParams();
    Object.entries(p).forEach(([k, v]) => v && k !== "view" && k !== "page" && q.set(k, v));
    if (!board) q.set("view", "board");
    const s = q.toString();
    return s ? `/tickets?${s}` : "/tickets";
  })();
  const filtered = Boolean(sanitizeSearch(p.q) || p.priority || p.client || (p.status && p.status !== "active"));
  const fmt = { tz: profile.timezone, dateFormat: profile.date_format, timeFormat: profile.time_format };

  return (
    <>
      <PageHeader
        title="Tickets"
        description={ws.type === "personal" ? "Support requests you're tracking yourself." : `Support requests in ${ws.name}.`}
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href={toggleHref}>{board ? <><List /> Table</> : <><Columns3 /> Board</>}</Link>
            </Button>
            <Button asChild>
              <Link href="/tickets/new"><Plus /> New ticket</Link>
            </Button>
          </>
        }
      />

      <nav className="no-print -mx-1 mb-4 flex gap-1 overflow-x-auto px-1" aria-label="Ticket views">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={viewHref(v.params as Record<string, string>)}
            aria-current={activeView === v.key ? "page" : undefined}
            className={cn(
              "whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] font-medium",
              activeView === v.key ? "bg-sidebar text-white" : "text-muted hover:bg-surface-2 hover:text-foreground",
            )}
          >
            {v.label}
          </Link>
        ))}
      </nav>

      <FilterBar
        className="mb-4"
        searchPlaceholder="Search by number, subject or description"
        filters={[
          ...(board ? [] : [{ name: "status", label: "Status", emptyLabel: "Active tickets", options: [...TICKET_STATUSES, { value: "all", label: "All statuses" }] }]),
          { name: "priority", label: "Priority", options: TICKET_PRIORITIES },
          ...(clients.length ? [{ name: "client", label: "Client", options: [...clients.map((c) => ({ value: c.id, label: c.name + (c.is_active ? "" : " (inactive)") })), { value: "none", label: "No client" }] }] : []),
          ...(staff.length > 1
            ? [{ name: "assignee", label: "Technician", options: [{ value: "me", label: "Me" }, { value: "unassigned", label: "Unassigned" }, ...staff.map((s) => ({ value: s.id, label: s.name }))] }]
            : []),
        ]}
        sort={
          board
            ? undefined
            : {
                name: "sort",
                label: "Sort order",
                options: [
                  { value: "created", label: "Sort: newest first" },
                  { value: "updated", label: "Sort: recently updated" },
                  { value: "priority", label: "Sort: priority" },
                  { value: "sla", label: "Sort: SLA deadline" },
                ],
              }
        }
      />

      {loadError && (
        <p role="alert" className="mb-4 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger">
          Tickets couldn&apos;t be loaded. Refresh to try again.
        </p>
      )}

      {board ? (
        <TicketBoard tickets={tickets} isAdmin={isAdminRole(m.role)} names={names} clients={clientNames} closedShown={closedShown} />
      ) : (
        <Panel>
          {tickets.length === 0 ? (
            filtered || p.assignee || p.sla ? (
              <EmptyState icon={Inbox} title="No tickets match" description="Try another view, or clear the filters." />
            ) : (
              <EmptyState
                icon={Inbox}
                title="No active tickets"
                description="New support requests appear here, whether you log them or customers raise them in the portal."
                action={<Button asChild><Link href="/tickets/new"><Plus /> New ticket</Link></Button>}
              />
            )
          ) : (
            <>
              <p className="sr-only" role="status">{total} tickets</p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] table-fixed text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[12px] text-muted">
                      <th scope="col" className="w-28 py-2.5 pl-5 font-medium">Ticket</th>
                      <th scope="col" className="py-2.5 pr-3 font-medium">Subject</th>
                      <th scope="col" className="w-36 py-2.5 pr-3 font-medium">Status</th>
                      <th scope="col" className="w-24 py-2.5 pr-3 font-medium">Priority</th>
                      <th scope="col" className="w-32 py-2.5 pr-3 font-medium">Technician</th>
                      <th scope="col" className="w-28 py-2.5 pr-3 font-medium">SLA</th>
                      <th scope="col" className="w-32 py-2.5 pr-5 font-medium">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {tickets.map((t) => (
                      <tr key={t.id} className="hover:bg-surface-2/60">
                        <td className="py-3 pl-5 align-top font-mono text-[12px] text-muted">{t.reference}</td>
                        <td className="py-3 pr-3 align-top">
                          <Link href={`/tickets/${t.id}`} className="font-medium hover:text-accent">{t.subject}</Link>
                          <p className="mt-0.5 truncate text-[12px] text-muted">
                            {[t.client_id ? clientNames[t.client_id] : null, t.requester_name || null, t.category].filter(Boolean).join(", ")}
                          </p>
                        </td>
                        <td className="py-3 pr-3 align-top"><TicketStatusLabel status={t.status} /></td>
                        <td className="py-3 pr-3 align-top"><TicketPriorityLabel priority={t.priority} /></td>
                        <td className="truncate py-3 pr-3 align-top text-[13px] text-muted">
                          {t.assignee_id ? names[t.assignee_id] ?? "Former member" : <span className="text-subtle">Unassigned</span>}
                        </td>
                        <td className="py-3 pr-3 align-top"><SlaChip ticket={t} /></td>
                        <td className="py-3 pr-5 align-top text-[12px] text-muted">{formatDateTime(t.created_at, fmt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-border px-4">
                <Pagination page={page} pageSize={25} total={total} basePath="/tickets" params={p} />
              </div>
            </>
          )}
        </Panel>
      )}
      <p className="mt-3 text-[12px] text-subtle">SLA deadlines are calendar-time targets (24 hours a day, 7 days a week).</p>
    </>
  );
}
