import type { Metadata } from "next";
import Link from "next/link";
import { AlarmClock, ArrowDown, ArrowRight, ArrowUp, BookOpen, Building2, CircleCheckBig, Inbox, MessageSquare, Plus, TriangleAlert, UserRound, ArrowRightLeft, Sparkles, Ticket as TicketIcon, Users } from "lucide-react";
import { getProfile, requireUser } from "@/lib/auth";
import { requireStaff } from "@/lib/workspace";
import { createClient } from "@/lib/supabase/server";
import { getClients, getPeople, loadMetricTickets, sweepSla } from "@/lib/ticket-data";
import { resolvePeriod } from "@/lib/period";
import { formatDuration, summarise, timeSeries } from "@/lib/service-metrics";
import { formatDate, formatDateTime, greetingFor, localDateOf, longDate, nowMs, timeAgo, todayIn } from "@/lib/dates";
import { ACTIVE_STATUSES, priorityLabel, statusLabel, ticketSla, TICKET_STATUSES, type Ticket, type TicketEvent } from "@/lib/tickets";
import { cn, first } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { PriorityPill, SlaChip, StatusPill, TicketPriorityLabel } from "@/components/tickets/ticket-badges";
import { CreatedResolvedChart } from "@/components/service/created-resolved-chart";
import { PeriodControls } from "@/components/service/period-controls";
import { StatusRing, type RingSlice } from "@/components/service/status-ring";

export const metadata: Metadata = { title: "Dashboard" };

type Row = Ticket & { reference: string; subject: string };

const DAY = 86_400_000;

function StatCard({
  label,
  value,
  icon: Icon,
  tile,
  href,
  delta,
}: {
  label: string;
  value: number;
  icon: typeof TicketIcon;
  tile: string;
  href: string;
  delta: { text: string; dir?: "up" | "down" | "flat"; tone?: "good" | "bad" | "neutral" };
}) {
  const DeltaIcon = delta.dir === "up" ? ArrowUp : delta.dir === "down" ? ArrowDown : null;
  const tone = delta.tone === "good" ? "text-ok" : delta.tone === "bad" ? "text-danger" : "text-muted";
  return (
    <Link href={href} className="group flex items-start gap-4 rounded-xl border border-border bg-surface p-4 shadow-panel transition-colors hover:border-border-strong">
      <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl", tile)} aria-hidden>
        <Icon className="h-6 w-6" />
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] text-muted">{label}</span>
        <span className="block text-[1.75rem] font-semibold leading-tight tabular-nums">{value}</span>
        <span className={cn("mt-0.5 flex items-center gap-1 text-[12px]", tone)}>
          {DeltaIcon && <DeltaIcon className="h-3.5 w-3.5" aria-hidden />}
          {delta.text}
        </span>
      </span>
    </Link>
  );
}

export default async function OverviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const m = await requireStaff();
  const profile = await getProfile();
  const ws = m.workspace;
  const tz = profile.timezone;
  const keep = { range: first(sp.range), from: first(sp.from), to: first(sp.to), client: first(sp.client), assignee: first(sp.assignee), status: first(sp.status) };
  const period = resolvePeriod(keep.range, keep.from, keep.to, tz);
  const now = nowMs();
  const weekAgo = new Date(now - 7 * DAY).toISOString();
  const twoWeeksAgo = new Date(now - 14 * DAY).toISOString();

  await sweepSla(ws.id);
  const supabase = await createClient();
  const [people, clients, metric, eventsRes, newClientsRes] = await Promise.all([
    getPeople(ws.id),
    getClients(ws.id),
    loadMetricTickets(ws.id, keep),
    supabase.from("ticket_events").select("id,ticket_id,actor_id,actor_name,kind,from_value,to_value,created_at").eq("workspace_id", ws.id).order("created_at", { ascending: false }).limit(60),
    supabase.from("clients").select("id", { count: "exact", head: true }).eq("workspace_id", ws.id).gte("created_at", weekAgo),
  ]);
  const tickets = metric.tickets as Row[];
  const s = summarise(tickets, period, now);
  const series = timeSeries(tickets, period.startDate, period.endDate, period.granularity, tz);
  const names = Object.fromEntries(people.map((p) => [p.id, p.name]));
  const clientNames = Object.fromEntries(clients.map((c) => [c.id, c.name]));
  const staff = people.filter((p) => p.role !== "client");
  const byId = new Map(tickets.map((t) => [t.id, t]));
  const fmt = { tz, dateFormat: profile.date_format, timeFormat: profile.time_format };
  const firstName = profile.display_name.split(" ")[0];
  const shared = ws.type !== "personal";

  // ---------------------------------------------------------------- stat cards (all from timestamps)
  const live = tickets.filter((t) => ACTIVE_STATUSES.includes(t.status));
  const openedThisWeek = tickets.filter((t) => t.created_at >= weekAgo).length;
  const resolvedThisWeek = tickets.filter((t) => t.resolved_at && t.resolved_at >= weekAgo).length;
  const resolvedLastWeek = tickets.filter((t) => t.resolved_at && t.resolved_at >= twoWeeksAgo && t.resolved_at < weekAgo).length;
  const diff = resolvedThisWeek - resolvedLastWeek;
  const dueNext24 = live.filter((t) => {
    const sla = ticketSla(t, now);
    return [sla.response, sla.resolution].some((x) => (x.state === "at_risk" || x.state === "on_track") && x.due && Date.parse(x.due) - now <= DAY);
  }).length;
  const activeClients = clients.filter((c) => c.is_active).length;

  const qs = (extra: Record<string, string>) => {
    const p = new URLSearchParams();
    if (keep.client) p.set("client", keep.client);
    if (keep.assignee) p.set("assignee", keep.assignee);
    Object.entries(extra).forEach(([k, v]) => p.set(k, v));
    const q = p.toString();
    return q ? `/tickets?${q}` : "/tickets";
  };

  // ---------------------------------------------------------------- ring
  const ring: RingSlice[] = [
    { key: "open", label: "Open", value: s.queue.open, color: "var(--ring-open)", href: qs({ status: "open" }) },
    { key: "progress", label: "In progress", value: s.queue.in_progress, color: "var(--ring-progress)", href: qs({ status: "in_progress" }) },
    { key: "resolved", label: "Resolved", value: s.queue.resolved, color: "var(--ring-resolved)", href: qs({ status: "resolved" }) },
    { key: "waiting", label: "Waiting", value: s.queue.waiting, color: "var(--ring-waiting)", href: qs({ status: "waiting_customer" }) },
  ];

  // ---------------------------------------------------------------- tables
  const recent = tickets.slice(0, 5);
  const upcoming = live
    .map((t) => {
      const sla = ticketSla(t, now);
      const targets = [sla.response, sla.resolution].filter((x) => x.due && ["breached", "at_risk", "on_track"].includes(x.state));
      const next = targets.sort((a, b) => Date.parse(a.due!) - Date.parse(b.due!))[0];
      return next ? { t, due: next.due!, state: next.state } : null;
    })
    .filter((x): x is { t: Row; due: string; state: "breached" | "at_risk" | "on_track" | "none" | "met" | "missed" } => x !== null)
    .sort((a, b) => Date.parse(a.due) - Date.parse(b.due))
    .slice(0, 5);
  const dueIn = (iso: string) => {
    const mins = Math.round((Date.parse(iso) - now) / 60_000);
    const abs = Math.abs(mins);
    const text = abs < 60 ? `${Math.max(abs, 1)} min` : abs < 48 * 60 ? `${Math.round(abs / 60)} hour${Math.round(abs / 60) === 1 ? "" : "s"}` : `${Math.round(abs / 1440)} days`;
    return mins < 0 ? `${text} ago` : text;
  };

  // ---------------------------------------------------------------- activity
  const filtering = Boolean(keep.client || keep.assignee || keep.status);
  const events = ((eventsRes.data ?? []) as TicketEvent[]).filter((e) => !filtering || byId.has(e.ticket_id)).slice(0, 6);
  const EVENT_ICON = { created: Sparkles, status: ArrowRightLeft, priority: TriangleAlert, assignee: UserRound, client: Building2, category: ArrowRightLeft, kb_link: BookOpen, sla: AlarmClock } as const;
  function eventText(e: TicketEvent, ref: string) {
    const who = e.kind === "sla" ? "" : `${e.actor_name || "System"} `;
    switch (e.kind) {
      case "created": return `${who}created ticket ${ref}`;
      case "status": return `${who}changed ${ref} to ${statusLabel(e.to_value ?? "").toLowerCase()}`;
      case "priority": return `${who}set ${ref} to ${priorityLabel(e.to_value ?? "").toLowerCase()} priority`;
      case "assignee": return e.to_value ? `${who}assigned ${ref} to ${names[e.to_value] ?? "a former member"}` : `${who}unassigned ${ref}`;
      case "client": return `${who}changed the client on ${ref}`;
      case "category": return `${who}recategorised ${ref} as ${e.to_value}`;
      case "kb_link": return e.to_value ? `${who}linked an article to ${ref}` : `${who}unlinked the article from ${ref}`;
      case "sla": return e.to_value === "response_breached" ? `First-response target missed on ${ref}` : `Resolution target missed on ${ref}`;
    }
  }

  const periodStats = [
    { label: "Tickets created", value: String(s.created) },
    { label: "Tickets resolved", value: String(s.resolved) },
    { label: "Avg first response", value: formatDuration(s.avgFirstResponseMin) },
    { label: "Avg resolution", value: formatDuration(s.avgResolutionMin) },
    { label: "Response SLA met", value: s.responseCompliance.pct === null ? "—" : `${s.responseCompliance.pct}%`, hint: `${s.responseCompliance.met} of ${s.responseCompliance.met + s.responseCompliance.missed} with a result` },
    { label: "Resolution SLA met", value: s.resolutionCompliance.pct === null ? "—" : `${s.resolutionCompliance.pct}%`, hint: `${s.resolutionCompliance.met} of ${s.resolutionCompliance.met + s.resolutionCompliance.missed} with a result` },
  ];
  const mine = live.filter((t) => t.assignee_id === user.id).slice(0, 5);

  return (
    <>
      {/* Header */}
      <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-muted">{longDate(todayIn(tz))}</p>
          <h1 className="mt-0.5 text-[1.6rem] font-semibold leading-tight tracking-[-0.01em]">
            {greetingFor(tz)}
            {firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="mt-0.5 text-sm text-muted">Here&apos;s what&apos;s happening at {ws.name}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild><Link href="/tickets/new"><Plus /> New ticket</Link></Button>
          {shared && <Button asChild variant="secondary"><Link href="/clients?new=1"><Building2 /> Add client</Link></Button>}
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

      {/* Stat cards */}
      <section aria-label="Key figures" className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Open tickets"
          value={live.length}
          icon={TicketIcon}
          tile="bg-accent-soft text-accent"
          href={qs({})}
          delta={{ text: `${openedThisWeek} opened in the last 7 days`, dir: openedThisWeek ? "up" : undefined, tone: "neutral" }}
        />
        <StatCard
          label="Overdue"
          value={s.overdueNow}
          icon={AlarmClock}
          tile="bg-danger-soft text-danger"
          href={qs({ sla: "breached" })}
          delta={{ text: `${dueNext24} more due in the next 24 h`, tone: dueNext24 ? "bad" : "neutral" }}
        />
        <StatCard
          label="Resolved, last 7 days"
          value={resolvedThisWeek}
          icon={CircleCheckBig}
          tile="bg-ok-soft text-ok"
          href={qs({ status: "resolved" })}
          delta={{
            text: diff === 0 ? `Same as the 7 days before` : `${Math.abs(diff)} ${diff > 0 ? "more" : "fewer"} than the 7 days before`,
            dir: diff > 0 ? "up" : diff < 0 ? "down" : "flat",
            tone: diff > 0 ? "good" : diff < 0 ? "bad" : "neutral",
          }}
        />
        {shared ? (
          <StatCard
            label="Active clients"
            value={activeClients}
            icon={Users}
            tile="bg-violet-soft text-violet"
            href="/clients"
            delta={{ text: `${newClientsRes.count ?? 0} added in the last 7 days`, dir: newClientsRes.count ? "up" : undefined, tone: newClientsRes.count ? "good" : "neutral" }}
          />
        ) : (
          <StatCard
            label="Due soon"
            value={s.atRiskNow}
            icon={TriangleAlert}
            tile="bg-violet-soft text-violet"
            href={qs({ sla: "at_risk" })}
            delta={{ text: "Less than a quarter of the target time left", tone: "neutral" }}
          />
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)] [&>*]:min-w-0">
        {/* Recent tickets */}
        <Panel>
          <PanelHeader title="Recent tickets" action={<Button asChild variant="secondary" size="sm"><Link href={qs({ status: "all" })}>View all</Link></Button>} />
          {recent.length ? (
            <>
              <ul className="divide-y divide-border md:hidden">
                {recent.map((t) => (
                  <li key={t.id}>
                    <Link href={`/tickets/${t.id}`} className="block px-5 py-3 hover:bg-surface-2">
                      <span className="flex items-center justify-between gap-2 text-[12px] text-muted">
                        <span className="font-mono">{t.reference}</span>
                        <span>{formatDate(localDateOf(t.created_at, tz), profile.date_format)}</span>
                      </span>
                      <span className="mt-0.5 block text-sm font-medium">{t.subject}</span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-2 text-[12px] text-muted">
                        <PriorityPill priority={t.priority} />
                        <StatusPill status={t.status} />
                        {t.client_id && clientNames[t.client_id] && <span>{clientNames[t.client_id]}</span>}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <table className="hidden w-full table-fixed text-sm md:table">
                <thead>
                  <tr className="border-b border-border text-left text-[12px] text-muted">
                    <th scope="col" className="w-24 py-2 pl-5 font-medium">#</th>
                    <th scope="col" className="py-2 pr-3 font-medium">Title</th>
                    {shared && <th scope="col" className="w-32 py-2 pr-3 font-medium">Client</th>}
                    <th scope="col" className="w-24 py-2 pr-3 font-medium">Priority</th>
                    <th scope="col" className="w-36 py-2 pr-3 font-medium">Status</th>
                    <th scope="col" className="w-20 py-2 pr-5 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recent.map((t) => (
                    <tr key={t.id} className="hover:bg-surface-2/60">
                      <td className="py-2.5 pl-5 font-mono text-[12px] text-muted">{t.reference}</td>
                      <td className="truncate py-2.5 pr-3"><Link href={`/tickets/${t.id}`} className="font-medium hover:text-accent">{t.subject}</Link></td>
                      {shared && <td className="truncate py-2.5 pr-3 text-[13px] text-muted">{t.client_id ? clientNames[t.client_id] ?? "—" : "—"}</td>}
                      <td className="py-2.5 pr-3"><PriorityPill priority={t.priority} /></td>
                      <td className="py-2.5 pr-3"><StatusPill status={t.status} /></td>
                      <td className="py-2.5 pr-5 text-[12px] text-muted">{formatDate(localDateOf(t.created_at, tz), profile.date_format).replace(/ \d{4}$/, "")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <EmptyState icon={Inbox} title="No tickets yet" description="Tickets you log, and requests customers raise in the portal, appear here." action={<Button asChild size="sm"><Link href="/tickets/new"><Plus /> New ticket</Link></Button>} />
          )}
        </Panel>

        {/* Status ring */}
        <Panel>
          <PanelHeader title="Ticket status" />
          <PanelBody>
            <StatusRing slices={ring} closed={s.queue.closed} />
          </PanelBody>
        </Panel>

        {/* Upcoming SLA deadlines */}
        <Panel>
          <PanelHeader title="Upcoming SLA deadlines" description="Calendar-time targets" action={<Button asChild variant="secondary" size="sm"><Link href={qs({ sort: "sla" })}>View all</Link></Button>} />
          {upcoming.length ? (
            <ul className="divide-y divide-border">
              {upcoming.map(({ t, due, state }) => (
                <li key={t.id}>
                  <Link href={`/tickets/${t.id}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-5 py-2.5 hover:bg-surface-2 sm:grid-cols-[88px_minmax(0,1fr)_120px_96px_auto]">
                    <span className="hidden font-mono text-[12px] text-muted sm:block">{t.reference}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{t.subject}</span>
                      <span className="block truncate text-[12px] text-muted sm:hidden">{t.reference}{t.client_id && clientNames[t.client_id] ? `, ${clientNames[t.client_id]}` : ""}</span>
                    </span>
                    <span className="hidden truncate text-[13px] text-muted sm:block">{t.client_id ? clientNames[t.client_id] ?? "—" : "—"}</span>
                    <span className={cn("hidden text-[13px] tabular-nums sm:block", state === "breached" ? "font-medium text-danger" : state === "at_risk" ? "text-danger" : "text-foreground")}>{dueIn(due)}</span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 justify-self-end whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] font-medium",
                        state === "breached" ? "bg-danger-soft text-danger" : state === "at_risk" ? "bg-warn-soft text-warn" : "bg-ok-soft text-ok",
                      )}
                    >
                      {state === "breached" ? <TriangleAlert className="h-3 w-3" aria-hidden /> : state === "at_risk" ? <AlarmClock className="h-3 w-3" aria-hidden /> : <CircleCheckBig className="h-3 w-3" aria-hidden />}
                      {state === "breached" ? "Overdue" : state === "at_risk" ? "Due soon" : "On track"}
                      <span className="sm:hidden">, {dueIn(due)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-4 text-sm text-muted">No open tickets with an SLA deadline.</p>
          )}
        </Panel>

        {/* Recent activity */}
        <Panel>
          <PanelHeader title="Recent activity" />
          {events.length ? (
            <ul className="divide-y divide-border">
              {events.map((e) => {
                const t = byId.get(e.ticket_id);
                const Icon = EVENT_ICON[e.kind] ?? MessageSquare;
                const sentence = eventText(e, t?.reference ?? "a ticket");
                const when = timeAgo(e.created_at, now, formatDateTime(e.created_at, fmt));
                return (
                  <li key={e.id}>
                    <Link href={t ? `/tickets/${t.id}` : "/tickets"} className="flex items-start gap-3 px-5 py-2.5 hover:bg-surface-2">
                      <span className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", e.kind === "sla" ? "bg-danger-soft text-danger" : e.kind === "status" && e.to_value === "resolved" ? "bg-ok-soft text-ok" : "bg-accent-soft text-accent")} aria-hidden>
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0 flex-1 text-[13px]">{sentence}</span>
                      <time dateTime={e.created_at} className="shrink-0 pt-0.5 text-[11px] text-subtle">{when}</time>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-5 py-4 text-sm text-muted">No ticket activity yet.</p>
          )}
        </Panel>

        {/* Performance for the selected period */}
        <Panel>
          <PanelHeader title="Performance" description={`${formatDate(period.startDate, profile.date_format)} to ${formatDate(period.endDate, profile.date_format)}, per ${period.granularity}. SLA figures count tickets created in this period whose targets have a result.`} />
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

        {/* Assigned to me */}
        <Panel>
          <PanelHeader title="Assigned to me" action={<Button asChild variant="ghost" size="sm"><Link href="/tickets?assignee=me">All <ArrowRight /></Link></Button>} />
          {mine.length ? (
            <ul className="divide-y divide-border">
              {mine.map((t) => (
                <li key={t.id}>
                  <Link href={`/tickets/${t.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-surface-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{t.subject}</span>
                      <span className="text-[12px] text-muted">{t.reference}{t.client_id && clientNames[t.client_id] ? `, ${clientNames[t.client_id]}` : ""}</span>
                    </span>
                    <span className="flex flex-col items-end gap-1">
                      <TicketPriorityLabel priority={t.priority} />
                      <SlaChip ticket={t} now={now} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={Inbox} title="Nothing assigned to you" description="Pick up an unassigned ticket, or check My tasks." action={<Button asChild size="sm" variant="secondary"><Link href="/tickets?assignee=unassigned">Unassigned tickets</Link></Button>} />
          )}
        </Panel>
      </div>
      <p className="mt-4 text-[12px] text-subtle">
        All figures come from saved tickets and clients. Comparisons use the last 7 days against the 7 days before. SLA deadlines are calendar-time targets.
        {metric.capped ? " Showing the most recent 10,000 tickets." : ""}
      </p>
    </>
  );
}
