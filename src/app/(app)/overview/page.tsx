import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Building2, Plus } from "lucide-react";
import { getProfile, requireUser } from "@/lib/auth";
import { requireStaff } from "@/lib/workspace";
import { createClient } from "@/lib/supabase/server";
import { getClients, getPeople, loadMetricTickets, sweepSla } from "@/lib/ticket-data";
import { resolvePeriod } from "@/lib/period";
import { formatDuration, summarise, timeSeries } from "@/lib/service-metrics";
import { formatDate, formatDateTime, greetingFor, longDate, nowMs, todayIn } from "@/lib/dates";
import { ACTIVE_STATUSES, priorityLabel, statusLabel, TICKET_STATUSES, type Ticket, type TicketEvent } from "@/lib/tickets";
import { first } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/card";
import { Led } from "@/components/shared/led";
import { EmptyState } from "@/components/shared/empty-state";
import { SlaChip, TicketPriorityLabel } from "@/components/tickets/ticket-badges";
import { CreatedResolvedChart } from "@/components/service/created-resolved-chart";
import { PeriodControls } from "@/components/service/period-controls";
import { Inbox } from "lucide-react";

export const metadata: Metadata = { title: "Overview" };

export default async function OverviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const m = await requireStaff();
  const profile = await getProfile();
  const ws = m.workspace;
  const tz = profile.timezone;
  const keep = { range: first(sp.range), from: first(sp.from), to: first(sp.to), client: first(sp.client), assignee: first(sp.assignee), status: first(sp.status) };
  const period = resolvePeriod(keep.range, keep.from, keep.to, tz);

  await sweepSla(ws.id);
  const supabase = await createClient();
  const [people, clients, metric, eventsRes] = await Promise.all([
    getPeople(ws.id),
    getClients(ws.id),
    loadMetricTickets(ws.id, keep),
    supabase.from("ticket_events").select("id,ticket_id,actor_id,actor_name,kind,from_value,to_value,created_at").eq("workspace_id", ws.id).order("created_at", { ascending: false }).limit(60),
  ]);
  const tickets = metric.tickets;
  const now = nowMs();
  const s = summarise(tickets, period, now);
  const series = timeSeries(tickets, period.startDate, period.endDate, period.granularity, tz);
  const names = Object.fromEntries(people.map((p) => [p.id, p.name]));
  const clientNames = Object.fromEntries(clients.map((c) => [c.id, c.name]));
  const staff = people.filter((p) => p.role !== "client");
  const mine = (tickets as Ticket[]).filter((t) => t.assignee_id === user.id && ACTIVE_STATUSES.includes(t.status)).slice(0, 8);
  const byId = new Map((tickets as (Ticket & { reference: string; subject: string })[]).map((t) => [t.id, t]));
  // With a client, technician or status filter, show only activity on matching tickets.
  const filtering = Boolean(keep.client || keep.assignee || keep.status);
  const events = ((eventsRes.data ?? []) as TicketEvent[]).filter((e) => !filtering || byId.has(e.ticket_id)).slice(0, 12);
  const fmt = { tz, dateFormat: profile.date_format, timeFormat: profile.time_format };
  const firstName = profile.display_name.split(" ")[0];
  const qs = (extra: Record<string, string>) => {
    const p = new URLSearchParams();
    if (keep.client) p.set("client", keep.client);
    if (keep.assignee) p.set("assignee", keep.assignee);
    Object.entries(extra).forEach(([k, v]) => p.set(k, v));
    return `/tickets?${p.toString()}`;
  };

  const queue = [
    { label: "Open", value: s.queue.open, tone: "accent" as const, href: qs({ status: "open" }) },
    { label: "In progress", value: s.queue.in_progress, tone: "warn" as const, href: qs({ status: "in_progress" }) },
    { label: "Waiting", value: s.queue.waiting, tone: "info" as const, href: qs({ status: "waiting_customer" }) },
    { label: "Overdue", value: s.overdueNow, tone: "danger" as const, href: qs({ sla: "breached" }) },
    { label: "Due soon", value: s.atRiskNow, tone: "warn" as const, href: qs({ sla: "at_risk" }) },
    { label: "Resolved", value: s.queue.resolved, tone: "ok" as const, href: qs({ status: "resolved" }) },
    { label: "Closed", value: s.queue.closed, tone: "idle" as const, href: qs({ status: "closed" }) },
  ];
  const periodStats = [
    { label: "Tickets created", value: String(s.created) },
    { label: "Tickets resolved", value: String(s.resolved) },
    { label: "Avg first response", value: formatDuration(s.avgFirstResponseMin) },
    { label: "Avg resolution", value: formatDuration(s.avgResolutionMin) },
    { label: "Response SLA met", value: s.responseCompliance.pct === null ? "—" : `${s.responseCompliance.pct}%`, hint: `${s.responseCompliance.met} of ${s.responseCompliance.met + s.responseCompliance.missed} with a result` },
    { label: "Resolution SLA met", value: s.resolutionCompliance.pct === null ? "—" : `${s.resolutionCompliance.pct}%`, hint: `${s.resolutionCompliance.met} of ${s.resolutionCompliance.met + s.resolutionCompliance.missed} with a result` },
  ];

  function eventText(e: TicketEvent) {
    switch (e.kind) {
      case "created": return "created";
      case "status": return `moved to ${statusLabel(e.to_value ?? "").toLowerCase()}`;
      case "priority": return `set priority to ${priorityLabel(e.to_value ?? "").toLowerCase()}`;
      case "assignee": return e.to_value ? `assigned to ${names[e.to_value] ?? "a former member"}` : "unassigned";
      case "client": return "changed the client of";
      case "category": return `recategorised as ${e.to_value}`;
      case "kb_link": return e.to_value ? "linked an article to" : "unlinked the article from";
      case "sla": return e.to_value === "response_breached" ? "missed the first-response target on" : "missed the resolution target on";
    }
  }

  return (
    <>
      <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-muted">{longDate(todayIn(tz))}, {ws.name}</p>
          <h1 className="mt-0.5 text-[1.6rem] font-semibold leading-tight tracking-[-0.01em]">{greetingFor(tz)}{firstName ? `, ${firstName}` : ""}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild><Link href="/tickets/new"><Plus /> New ticket</Link></Button>
          {ws.type !== "personal" && <Button asChild variant="secondary"><Link href="/clients"><Building2 /> Add client</Link></Button>}
          <Button asChild variant="secondary"><Link href="/knowledge/new"><BookOpen /> Write article</Link></Button>
        </div>
      </div>

      <PeriodControls
        period={period}
        path="/overview"
        keep={keep}
        filters={[
          ...(clients.length ? [{ name: "client", label: "Client", options: [...clients.map((c) => ({ value: c.id, label: c.name })), { value: "none", label: "No client" }] }] : []),
          ...(staff.length > 1 ? [{ name: "assignee", label: "Technician", options: [{ value: "unassigned", label: "Unassigned" }, ...staff.map((x) => ({ value: x.id, label: x.name }))] }] : []),
          { name: "status", label: "Status", options: TICKET_STATUSES },
        ]}
      />

      {metric.error && <p role="alert" className="mb-4 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger">Some figures couldn&apos;t be loaded. Refresh to try again.</p>}

      <Panel className="mb-6">
        <div className="flex items-center justify-between border-b border-border px-5 py-2.5">
          <h2 className="text-sm font-semibold">Current queue</h2>
          <span className="text-[12px] text-muted">{tickets.length} ticket{tickets.length === 1 ? "" : "s"} in total</span>
        </div>
        <ul className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 lg:divide-x divide-border">
          {queue.map((q) => (
            <li key={q.label}>
              <Link href={q.href} className="flex h-full flex-col gap-1 px-5 py-3.5 hover:bg-surface-2">
                <span className="flex items-center gap-2 text-[13px] text-muted"><Led tone={q.value ? q.tone : "idle"} pulse={q.label === "Overdue" && q.value > 0} />{q.label}</span>
                <span className="text-2xl font-semibold tabular-nums">{q.value}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] [&>*]:min-w-0">
        <Panel>
          <PanelHeader title={`${formatDate(period.startDate, profile.date_format)} to ${formatDate(period.endDate, profile.date_format)}`} description={`Per ${period.granularity}. SLA figures count tickets created in this period whose targets have a result.`} />
          <PanelBody className="space-y-5">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
              {periodStats.map((p) => (
                <div key={p.label}>
                  <dt className="text-[12px] text-muted">{p.label}</dt>
                  <dd className="text-xl font-semibold tabular-nums">{p.value}</dd>
                  {p.hint && <dd className="text-[11px] text-subtle">{p.hint}</dd>}
                </div>
              ))}
            </dl>
            <CreatedResolvedChart data={series} caption={`Tickets created and resolved per ${period.granularity}`} />
          </PanelBody>
        </Panel>

        <div className="space-y-6">
          <Panel>
            <PanelHeader title="Assigned to me" action={<Button asChild variant="ghost" size="sm"><Link href="/tickets?assignee=me">All</Link></Button>} />
            {mine.length ? (
              <ul className="divide-y divide-border">
                {mine.map((t) => {
                  const tt = t as Ticket & { reference: string; subject: string };
                  return (
                    <li key={t.id}>
                      <Link href={`/tickets/${t.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-surface-2">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{tt.subject}</span>
                          <span className="text-[12px] text-muted">{tt.reference}{t.client_id && clientNames[t.client_id] ? `, ${clientNames[t.client_id]}` : ""}</span>
                        </span>
                        <TicketPriorityLabel priority={t.priority} />
                        <SlaChip ticket={t} now={now} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState icon={Inbox} title="Nothing assigned to you" description="Pick up an unassigned ticket, or check My tasks for your own work." action={<Button asChild size="sm" variant="secondary"><Link href="/tickets?assignee=unassigned">Unassigned tickets</Link></Button>} />
            )}
          </Panel>

          <Panel>
            <PanelHeader title="Recent activity" />
            {events.length ? (
              <ul className="divide-y divide-border">
                {events.map((e) => {
                  const t = byId.get(e.ticket_id);
                  return (
                    <li key={e.id} className="px-5 py-2.5 text-[13px]">
                      <span className="font-medium">{e.kind === "sla" ? "SLA" : e.actor_name || "System"}</span>{" "}
                      <span className="text-muted">{eventText(e)}</span>{" "}
                      {t ? <Link href={`/tickets/${t.id}`} className="font-medium hover:text-accent">{t.reference}</Link> : <span className="text-muted">a ticket</span>}
                      <span className="block text-[11px] text-subtle">{formatDateTime(e.created_at, fmt)}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="px-5 py-4 text-sm text-muted">No ticket activity yet.</p>
            )}
          </Panel>
        </div>
      </div>
      <p className="mt-4 text-[12px] text-subtle">All figures come from saved tickets. SLA deadlines are calendar-time targets.{metric.capped ? " Showing the most recent 10,000 tickets." : ""}</p>
    </>
  );
}
