import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, NotebookPen, Pencil, Plus } from "lucide-react";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addDays, daysBetween, longDate, todayIn, weekdayIndex } from "@/lib/dates";
import { first, sanitizeSearch } from "@/lib/utils";
import type { WorkLog } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody } from "@/components/ui/card";
import { DemoBadge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { FilterBar } from "@/components/shared/filter-bar";
import { EmptyState } from "@/components/shared/empty-state";
import { WORKLOG_FIELDS } from "@/components/worklog/fields";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Work log" };

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function monthBounds(month: string) {
  const [y, m] = month.split("-").map(Number);
  const start = `${month}-01`;
  const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const prev = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
  const next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
  return { start, end, prev, next, label: `${MONTHS[m - 1]} ${y}` };
}

export default async function WorkLogPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const profile = await getProfile();
  const today = todayIn(profile.timezone);
  const rawMonth = first(sp.month);
  const month = rawMonth && /^\d{4}-(0[1-9]|1[0-2])$/.test(rawMonth) ? rawMonth : today.slice(0, 7);
  const { start, end, prev, next, label } = monthBounds(month);
  const q = sanitizeSearch(first(sp.q));
  const supabase = await createClient();

  let query = supabase.from("work_logs").select("*").order("log_date", { ascending: false });
  if (q) {
    query = query
      .or(WORKLOG_FIELDS.map((f) => `${f.key}.ilike."%${q}%"`).join(","))
      .limit(100);
  } else {
    query = query.gte("log_date", start).lte("log_date", end);
  }
  const [{ data, error }, todayRes, countRes] = await Promise.all([
    query,
    supabase.from("work_logs").select("id").eq("log_date", today).maybeSingle(),
    supabase.from("work_logs").select("id", { count: "exact", head: true }),
  ]);
  const entries = (data ?? []) as WorkLog[];
  const logged = new Set(entries.map((e) => e.log_date));
  const todayId = todayRes.data?.id as string | undefined;

  // Monday-first calendar grid
  const lead = (weekdayIndex(start) + 6) % 7;
  const cells: (string | null)[] = [...Array(lead).fill(null), ...daysBetween(start, end)];
  while (cells.length % 7) cells.push(null);
  const pastDays = daysBetween(start, end < today ? end : today).filter((d) => d >= start).length;
  const loggedThisMonth = entries.filter((e) => e.log_date >= start && e.log_date <= end).length;

  return (
    <>
      <PageHeader
        title="Work log"
        description="A short record of each day: what you did, what you investigated and what you learned."
        actions={
          <Button asChild>
            <Link href={todayId ? `/worklog/${todayId}/edit` : "/worklog/new"}>
              {todayId ? <Pencil /> : <Plus />} {todayId ? "Edit today's entry" : "Write today's entry"}
            </Link>
          </Button>
        }
      />
      <FilterBar className="mb-5" searchPlaceholder="Search all entries" />

      {error && (
        <p role="alert" className="mb-4 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger">
          The work log couldn&apos;t be loaded. Refresh to try again.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        {!q && (
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <Panel>
              <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
                <Button asChild variant="ghost" size="icon-sm"><Link href={`/worklog?month=${prev}`} aria-label="Previous month"><ChevronLeft /></Link></Button>
                <h2 className="text-sm font-semibold">{label}</h2>
                <Button asChild variant="ghost" size="icon-sm"><Link href={`/worklog?month=${next}`} aria-label="Next month"><ChevronRight /></Link></Button>
              </div>
              <PanelBody className="p-3">
                <div className="grid grid-cols-7 text-center text-[11px] text-subtle" aria-hidden>
                  {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => <span key={d} className="py-1">{d}</span>)}
                </div>
                <div className="grid grid-cols-7 gap-0.5">
                  {cells.map((d, i) => {
                    if (!d) return <span key={`e${i}`} />;
                    const has = logged.has(d);
                    const future = d > today;
                    const dayNum = Number(d.slice(8));
                    const href = has ? `#d-${d}` : `/worklog/new?date=${d}`;
                    return (
                      <Link
                        key={d}
                        href={future ? "#" : href}
                        aria-disabled={future}
                        tabIndex={future ? -1 : undefined}
                        aria-label={`${longDate(d)}: ${has ? "entry written" : future ? "future date" : "no entry, write one"}`}
                        className={cn(
                          "relative flex aspect-square flex-col items-center justify-center rounded-md text-[13px] tabular-nums transition-colors",
                          future ? "pointer-events-none text-subtle/60" : "hover:bg-surface-2",
                          d === today && "ring-1 ring-accent",
                          has && "font-semibold",
                        )}
                      >
                        {dayNum}
                        <span className={cn("led mt-0.5 h-1.5 w-1.5", has ? "text-ok" : "text-transparent shadow-none")} aria-hidden />
                      </Link>
                    );
                  })}
                </div>
                <p className="mt-3 px-1 text-[12px] text-muted">
                  {loggedThisMonth} of {pastDays} day{pastDays === 1 ? "" : "s"} logged. Select a day to write or view its entry.
                </p>
              </PanelBody>
            </Panel>
            <p className="mt-3 px-1 text-[12px] text-subtle">{countRes.count ?? 0} entries in total</p>
          </aside>
        )}

        <section className={cn(q && "lg:col-span-2")} aria-label="Entries">
          {q && <p className="mb-3 text-[13px] text-muted" role="status">{entries.length} matching entr{entries.length === 1 ? "y" : "ies"}</p>}
          {entries.length === 0 ? (
            <Panel>
              {q ? (
                <EmptyState icon={NotebookPen} title="No entries match" description="Try different words." />
              ) : (
                <EmptyState
                  icon={NotebookPen}
                  title={`No entries in ${label}`}
                  description="A few lines a day adds up to a record you can use in reviews, reports and interviews."
                  action={<Button asChild><Link href="/worklog/new"><Plus /> Write today&apos;s entry</Link></Button>}
                />
              )}
            </Panel>
          ) : (
            <ol className="space-y-4">
              {entries.map((e) => {
                const filled = WORKLOG_FIELDS.filter((f) => String(e[f.key] ?? "").trim());
                return (
                  <li key={e.id} id={`d-${e.log_date}`} className="scroll-mt-20">
                    <Panel>
                      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
                        <div className="flex items-center gap-2">
                          <h2 className="text-[15px] font-semibold">{longDate(e.log_date)}</h2>
                          {e.log_date === today && <span className="text-[12px] text-accent">Today</span>}
                          {e.is_demo && <DemoBadge />}
                        </div>
                        <Button asChild variant="ghost" size="sm"><Link href={`/worklog/${e.id}/edit`}><Pencil /> Edit</Link></Button>
                      </div>
                      <dl className="grid gap-x-6 gap-y-4 px-5 py-4 md:grid-cols-2">
                        {filled.map((f) => (
                          <div key={f.key} className={f.key === "tasks_performed" || f.key === "reflections" ? "md:col-span-2" : ""}>
                            <dt className="text-[12px] font-medium text-muted">{f.label}</dt>
                            <dd className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{String(e[f.key])}</dd>
                          </div>
                        ))}
                      </dl>
                    </Panel>
                  </li>
                );
              })}
            </ol>
          )}
          {!q && entries.length > 0 && start <= addDays(today, 0) && (
            <div className="mt-4 flex justify-between text-sm">
              <Link href={`/worklog?month=${prev}`} className="text-accent hover:underline">Earlier month</Link>
              {month < today.slice(0, 7) && <Link href={`/worklog?month=${next}`} className="text-accent hover:underline">Later month</Link>}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
