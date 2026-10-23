import type { Metadata } from "next";
import Link from "next/link";
import { FileSpreadsheet } from "lucide-react";
import { getProfile } from "@/lib/auth";
import { requireStaff } from "@/lib/workspace";
import { getClients, getPeople, loadMetricTickets } from "@/lib/ticket-data";
import { resolvePeriod } from "@/lib/period";
import { formatDuration, summarise, timeSeries, type Granularity, type GroupRow } from "@/lib/service-metrics";
import { formatDate } from "@/lib/dates";
import { priorityLabel } from "@/lib/tickets";
import { first } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { CreatedResolvedChart } from "@/components/service/created-resolved-chart";
import { PeriodControls } from "@/components/service/period-controls";
import { PrintButton } from "@/components/service/print-button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Service reports" };

const pct = (v: number | null) => (v === null ? "—" : `${v}%`);

function GroupTable({ title, rows, label, emptyText }: { title: string; rows: GroupRow[]; label: (key: string) => string; emptyText: string }) {
  const max = Math.max(1, ...rows.map((r) => r.created));
  return (
    <Panel className="print-area break-inside-avoid">
      <PanelHeader title={title} />
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[12px] text-muted">
                <th scope="col" className="py-2 pl-5 pr-3 font-medium">Group</th>
                <th scope="col" className="w-40 py-2 pr-3 font-medium">Created</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">Resolved</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">Open now</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">Avg resolution</th>
                <th scope="col" className="py-2 pr-5 text-right font-medium">Resolution SLA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.key || "none"}>
                  <th scope="row" className="py-2 pl-5 pr-3 text-left font-medium">{label(r.key)}</th>
                  <td className="py-2 pr-3">
                    <span className="flex items-center gap-2">
                      <span className="h-1.5 rounded-full bg-[var(--series-1)]" style={{ width: `${(r.created / max) * 80}px`, minWidth: r.created ? 4 : 0 }} aria-hidden />
                      <span className="tabular-nums">{r.created}</span>
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.resolved}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.open}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatDuration(r.avgResolutionMin)}</td>
                  <td className="py-2 pr-5 text-right tabular-nums">{pct(r.resolutionCompliance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-5 py-4 text-sm text-muted">{emptyText}</p>
      )}
    </Panel>
  );
}

export default async function ServiceReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const m = await requireStaff();
  const profile = await getProfile();
  const ws = m.workspace;
  const keep = { range: first(sp.range), from: first(sp.from), to: first(sp.to), client: first(sp.client), assignee: first(sp.assignee), by: first(sp.by) };
  const period = resolvePeriod(keep.range, keep.from, keep.to, profile.timezone);
  const by: Granularity = keep.by === "day" || keep.by === "week" || keep.by === "month" ? keep.by : period.granularity;

  const [people, clients, metric] = await Promise.all([getPeople(ws.id), getClients(ws.id), loadMetricTickets(ws.id, { client: keep.client, assignee: keep.assignee })]);
  const s = summarise(metric.tickets, period);
  const series = timeSeries(metric.tickets, period.startDate, period.endDate, by, profile.timezone);
  const names = Object.fromEntries(people.map((p) => [p.id, p.name]));
  const clientNames = Object.fromEntries(clients.map((c) => [c.id, c.name]));
  const staff = people.filter((p) => p.role !== "client");
  const csv = new URLSearchParams(Object.entries({ range: period.range, from: period.startDate, to: period.endDate, client: keep.client ?? "", assignee: keep.assignee ?? "" }).filter(([, v]) => v) as [string, string][]);
  const filterNote = [keep.client ? `Client: ${keep.client === "none" ? "no client" : clientNames[keep.client] ?? "unknown"}` : null, keep.assignee ? `Technician: ${keep.assignee === "unassigned" ? "unassigned" : names[keep.assignee] ?? "unknown"}` : null].filter(Boolean).join(". ");
  const byHref = (g: Granularity) => {
    const q = new URLSearchParams(Object.entries(keep).filter(([k, v]) => v && k !== "by") as [string, string][]);
    q.set("by", g);
    return `/service-reports?${q.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="Service reports"
        description={`${ws.name}: ${formatDate(period.startDate, profile.date_format)} to ${formatDate(period.endDate, profile.date_format)}.${filterNote ? ` ${filterNote}.` : ""}`}
        actions={
          <>
            <Button asChild variant="secondary"><a href={`/api/export/service-report?${csv.toString()}`}><FileSpreadsheet /> Export CSV</a></Button>
            <PrintButton />
          </>
        }
      />
      <PeriodControls
        period={period}
        path="/service-reports"
        keep={keep}
        filters={[
          ...(clients.length ? [{ name: "client", label: "Client", options: [...clients.map((c) => ({ value: c.id, label: c.name })), { value: "none", label: "No client" }] }] : []),
          ...(staff.length > 1 ? [{ name: "assignee", label: "Technician", options: [{ value: "unassigned", label: "Unassigned" }, ...staff.map((x) => ({ value: x.id, label: x.name }))] }] : []),
        ]}
      />
      {metric.error && <p role="alert" className="mb-4 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger">Some figures couldn&apos;t be loaded. Refresh to try again.</p>}

      <div className="space-y-6">
        <Panel className="print-area">
          <PanelBody>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
              {[
                ["Created", String(s.created), null],
                ["Resolved", String(s.resolved), null],
                ["Avg first response", formatDuration(s.avgFirstResponseMin), null],
                ["Avg resolution", formatDuration(s.avgResolutionMin), null],
                ["First-response SLA met", pct(s.responseCompliance.pct), `${s.responseCompliance.met} met, ${s.responseCompliance.missed} missed, ${s.responseCompliance.pending} still running`],
                ["Resolution SLA met", pct(s.resolutionCompliance.pct), `${s.resolutionCompliance.met} met, ${s.resolutionCompliance.missed} missed, ${s.resolutionCompliance.pending} still running`],
                ["Overdue now", String(s.overdueNow), null],
                ["Due soon", String(s.atRiskNow), null],
              ].map(([k, v, h]) => (
                <div key={k}>
                  <dt className="text-[12px] text-muted">{k}</dt>
                  <dd className="text-xl font-semibold tabular-nums">{v}</dd>
                  {h && <dd className="text-[11px] text-subtle">{h}</dd>}
                </div>
              ))}
            </dl>
            <p className="mt-4 text-[12px] text-subtle">
              Averages and SLA results use stored timestamps only. A target counts as met or missed once the ticket was responded to or resolved, or once its deadline passed; targets still running are not counted. First response is the first public reply from staff. Targets are calendar time.
            </p>
          </PanelBody>
        </Panel>

        <Panel className="print-area break-inside-avoid">
          <PanelHeader
            title="Created and resolved"
            action={
              <div className="no-print flex gap-1" role="group" aria-label="Group by">
                {(["day", "week", "month"] as const).map((g) => (
                  <Link key={g} href={byHref(g)} aria-current={by === g ? "true" : undefined} className={cn("rounded-md px-2.5 py-1 text-[12px] font-medium capitalize", by === g ? "bg-sidebar text-white" : "text-muted hover:bg-surface-2")}>
                    {g === "day" ? "Daily" : g === "week" ? "Weekly" : "Monthly"}
                  </Link>
                ))}
              </div>
            }
          />
          <PanelBody>
            <CreatedResolvedChart data={series} caption={`Tickets created and resolved, ${by === "day" ? "daily" : by === "week" ? "weekly" : "monthly"}`} />
          </PanelBody>
        </Panel>

        <GroupTable title="By priority" rows={s.byPriority} label={(k) => priorityLabel(k)} emptyText="No tickets in this period." />
        <GroupTable title="By category" rows={s.byCategory} label={(k) => k || "Uncategorised"} emptyText="No tickets in this period." />
        <GroupTable title="Technician workload" rows={s.byTechnician} label={(k) => (k ? names[k] ?? "Former member" : "Unassigned")} emptyText="No assigned tickets in this period." />
        {clients.length > 0 && <GroupTable title="By client" rows={s.byClient} label={(k) => (k ? clientNames[k] ?? "Removed client" : "No client")} emptyText="No client tickets in this period." />}
      </div>
    </>
  );
}
