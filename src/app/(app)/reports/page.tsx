import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getProfile } from "@/lib/auth";
import { addDays, formatDateTime, isIsoDate, todayIn, weekRange } from "@/lib/dates";
import { loadReport } from "@/lib/report-data";
import { reportToText } from "@/lib/reports";
import { first } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { Led } from "@/components/shared/led";
import { ReportEditor } from "@/components/reports/report-editor";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const profile = await getProfile();
  const today = todayIn(profile.timezone);
  const kind = first(sp.type) === "weekly" ? "weekly" : "daily";
  const rawDate = first(sp.date);
  const date = rawDate && isIsoDate(rawDate) ? rawDate : today;
  const { start, end } = kind === "weekly" ? weekRange(date) : { start: date, end: date };
  const step = kind === "weekly" ? 7 : 1;
  const prev = addDays(date, -step);
  const next = addDays(date, step);
  const canGoNext = (kind === "weekly" ? weekRange(next).start : next) <= today;

  const { report, error } = await loadReport(kind, start, end, profile);
  const generatedOn = formatDateTime(new Date().toISOString(), { tz: profile.timezone, dateFormat: profile.date_format, timeFormat: profile.time_format });
  const text = reportToText(report, generatedOn);
  const s = report.stats;
  const href = (t: string, d: string) => `/reports?type=${t}&date=${d}`;

  return (
    <>
      <PageHeader title="Reports" description="Summaries built only from what you've saved: completed tasks, work logs and knowledge-base records. Nothing is filled in for you." />

      <div className="no-print mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="tablist" aria-label="Report type" className="inline-flex rounded-lg border border-border bg-surface p-1">
          {(["daily", "weekly"] as const).map((t) => (
            <Link
              key={t}
              role="tab"
              aria-selected={kind === t}
              href={href(t, date)}
              className={cn("rounded-md px-4 py-1.5 text-sm font-medium capitalize", kind === t ? "bg-sidebar text-white" : "text-muted hover:text-foreground")}
            >
              {t}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="icon-sm"><Link href={href(kind, prev)} aria-label={`Previous ${kind === "weekly" ? "week" : "day"}`}><ChevronLeft /></Link></Button>
          <span className="min-w-44 text-center text-sm font-medium">{report.subtitle}</span>
          {canGoNext ? (
            <Button asChild variant="ghost" size="icon-sm"><Link href={href(kind, next)} aria-label={`Next ${kind === "weekly" ? "week" : "day"}`}><ChevronRight /></Link></Button>
          ) : (
            <span className="inline-flex h-8 w-8" />
          )}
          {date !== today && <Button asChild variant="link" size="sm" className="ml-2"><Link href={href(kind, today)}>{kind === "weekly" ? "This week" : "Today"}</Link></Button>}
        </div>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger">
          Some data couldn&apos;t be loaded, so this report may be incomplete. Refresh to try again.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <ReportEditor generated={text} fileBase={`${kind}-report_${start}${kind === "weekly" ? `_to_${end}` : ""}`} csvHref={`/api/export/tasks?start=${start}&end=${end}`} />

        <aside className="no-print space-y-4">
          <Panel className="p-5">
            <h2 className="text-sm font-semibold">{kind === "weekly" ? "This week in numbers" : "Today in numbers"}</h2>
            <dl className="mt-3 space-y-2.5 text-sm">
              {[
                ["Tasks completed", s.completed],
                ["Tasks created", s.created],
                ["In progress now", s.inProgress],
                ["Overdue", s.overdue],
                ["Completion rate", s.completionRate === null ? "No tasks due" : `${s.completionRate}%`],
                [kind === "weekly" ? "Days logged" : "Work log", kind === "weekly" ? `${s.daysLogged} of ${s.days}` : s.daysLogged ? "Written" : "Not written"],
              ].map(([k, v]) => (
                <div key={String(k)} className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted">{k}</dt>
                  <dd className="font-medium tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-[12px] text-subtle">Completion rate counts tasks due in this period: completed vs. still open.</p>
          </Panel>
          {kind === "weekly" && (
            <Panel className="p-5">
              <h2 className="text-sm font-semibold">Day by day</h2>
              <ul className="mt-3 space-y-1.5">
                {s.perDay.map((d) => (
                  <li key={d.date} className="flex items-center gap-3 text-sm">
                    <span className="w-9 text-muted">{d.day}</span>
                    <span className="flex-1">
                      <span className="block h-1.5 rounded-full bg-accent" style={{ width: `${Math.min(100, d.completed * 20)}%`, minWidth: d.completed ? 6 : 0 }} />
                    </span>
                    <span className="w-5 text-right tabular-nums">{d.completed}</span>
                    <Led tone={d.logged ? "ok" : "idle"} />
                    <span className="sr-only">{d.logged ? "log written" : "no log"}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[12px] text-subtle">Bars: tasks completed. Light: work log written.</p>
            </Panel>
          )}
          {s.daysLogged === 0 && (
            <Panel className="p-5 text-sm">
              <p className="text-muted">No work log for this {kind === "weekly" ? "week" : "day"} yet. Reports draw problems, skills and follow-ups from it.</p>
              <Button asChild size="sm" variant="secondary" className="mt-3"><Link href={`/worklog/new?date=${kind === "weekly" ? (today <= end ? today : end) : date}`}>Write a log entry</Link></Button>
            </Panel>
          )}
        </aside>
      </div>
    </>
  );
}
