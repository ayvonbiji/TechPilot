import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, CalendarClock, GraduationCap, ListChecks, NotebookPen, Plus, SquareTerminal, Wrench } from "lucide-react";
import { getProfile, requireUser } from "@/lib/auth";
import { requireStaff } from "@/lib/workspace";
import { createClient } from "@/lib/supabase/server";
import { addDays, formatDate, greetingFor, localDateOf, longDate, shortDay, todayIn, utcRangeForDates, weekRange } from "@/lib/dates";
import { labelFor, SKILL_STATUSES } from "@/lib/constants";
import type { Skill, Task, TroubleshootingRecord } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/card";
import { Badge, DemoBadge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Led } from "@/components/shared/led";
import { EmptyState } from "@/components/shared/empty-state";
import { WeeklyChart, type DayPoint } from "@/components/dashboard/weekly-chart";
import { PriorityMark, StatusLight, isOverdue } from "@/components/tasks/task-indicators";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  await requireUser();
  const profile = await getProfile();
  const { workspace } = await requireStaff();
  const tz = profile.timezone;
  const today = todayIn(tz);
  const weekStart = addDays(today, -6);
  const { from } = utcRangeForDates(weekStart, today, tz);
  const thisWeek = weekRange(today);
  const supabase = await createClient();

  const [openRes, doneRes, doneTotalRes, kbRes, logsRes, skillsRes, notesCountRes] = await Promise.all([
    supabase
      .from("tasks")
      .select("id,title,status,priority,due_date,category,is_demo")
      .neq("status", "completed")
      .order("due_date", { ascending: true, nullsFirst: false }),
    supabase.from("tasks").select("id,completed_at").eq("status", "completed").gte("completed_at", from),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("status", "completed"),
    supabase
      .from("troubleshooting_records")
      .select("id,title,category,status,created_at,is_demo")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("work_logs").select("log_date").gte("log_date", weekStart).lte("log_date", today),
    supabase
      .from("skills")
      .select("id,name,category,kind,status,current_level,target_level,completed_on,updated_at,is_demo")
      .neq("status", "not_started")
      .order("updated_at", { ascending: false })
      .limit(5),
    supabase.from("notes").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id),
  ]);

  const loadError = [openRes, doneRes, kbRes, logsRes, skillsRes].find((r) => r.error);
  const open = (openRes.data ?? []) as Pick<Task, "id" | "title" | "status" | "priority" | "due_date" | "category" | "is_demo">[];
  const recentDone = (doneRes.data ?? []) as Pick<Task, "id" | "completed_at">[];
  const records = (kbRes.data ?? []) as Pick<TroubleshootingRecord, "id" | "title" | "category" | "status" | "created_at" | "is_demo">[];
  const loggedDays = new Set((logsRes.data ?? []).map((l: { log_date: string }) => l.log_date));
  const skills = (skillsRes.data ?? []) as Skill[];

  const dueToday = open.filter((t) => t.due_date === today);
  const overdue = open.filter((t) => isOverdue(t, today));
  const inProgress = open.filter((t) => t.status === "in_progress");
  const pending = open.filter((t) => t.status === "pending");
  const completedThisWeek = recentDone.filter((t) => t.completed_at && localDateOf(t.completed_at, tz) >= thisWeek.start).length;
  const focus = [...overdue, ...dueToday.filter((t) => !overdue.includes(t))].slice(0, 6);

  const chart: DayPoint[] = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    return {
      date: formatDate(date, profile.date_format),
      day: shortDay(date),
      completed: recentDone.filter((t) => t.completed_at && localDateOf(t.completed_at, tz) === date).length,
      logged: loggedDays.has(date),
      isToday: date === today,
    };
  });
  const weekTotal = chart.reduce((n, d) => n + d.completed, 0);

  const isNew = workspace.type === "personal" && open.length === 0 && (doneTotalRes.count ?? 0) === 0 && records.length === 0 && (notesCountRes.count ?? 0) === 0;
  const firstName = profile.display_name.split(" ")[0];

  const stats = [
    { label: "Due today", value: dueToday.length, tone: dueToday.length ? "accent" : "idle", href: `/tasks?due=today` },
    { label: "Overdue", value: overdue.length, tone: overdue.length ? "danger" : "idle", href: `/tasks?due=overdue` },
    { label: "In progress", value: inProgress.length, tone: inProgress.length ? "warn" : "idle", href: `/tasks?status=in_progress` },
    { label: "Pending", value: pending.length, tone: "idle", href: `/tasks?status=pending` },
    { label: "Completed this week", value: completedThisWeek, tone: completedThisWeek ? "ok" : "idle", href: `/tasks?status=completed` },
  ] as const;

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-muted">{longDate(today)}</p>
          <h1 className="mt-0.5 text-[1.6rem] font-semibold leading-tight tracking-[-0.01em]">
            {greetingFor(tz)}
            {firstName ? `, ${firstName}` : ""}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/tasks?new=1"><Plus /> New task</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/knowledge/new"><Wrench /> Troubleshooting record</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/notes/new"><SquareTerminal /> Note</Link>
          </Button>
        </div>
      </div>

      {loadError && (
        <p role="alert" className="mb-4 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger">
          Some data couldn&apos;t be loaded. Refresh the page to try again.
        </p>
      )}

      {isNew && (
        <Panel className="mb-6 border-accent/30">
          <PanelBody className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-semibold">Your workspace is empty</h2>
              <p className="mt-1 max-w-[62ch] text-sm text-muted">
                Start with a task for today, or import the command reference library. To explore first, load demo
                data from Settings — it&apos;s clearly marked and removable in one click.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button asChild variant="secondary"><Link href="/notes?import=1">Import command library</Link></Button>
              <Button asChild variant="secondary"><Link href="/settings#demo">Load demo data</Link></Button>
            </div>
          </PanelBody>
        </Panel>
      )}

      <Panel className="mb-6">
        <ul className="grid grid-cols-2 divide-border sm:grid-cols-3 lg:grid-cols-5 lg:divide-x">
          {stats.map((s) => (
            <li key={s.label} className="border-b border-border last:border-b-0 sm:[&:nth-last-child(-n+2)]:border-b-0 lg:border-b-0">
              <Link href={s.href} className="flex h-full flex-col gap-1 px-5 py-4 transition-colors hover:bg-surface-2">
                <span className="flex items-center gap-2 text-[13px] text-muted">
                  <Led tone={s.tone} pulse={s.label === "In progress" && s.value > 0} />
                  {s.label}
                </span>
                <span className="text-2xl font-semibold tabular-nums">{s.value}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] [&>*]:min-w-0">
        <Panel>
          <PanelHeader
            title="Today's focus"
            description="Overdue tasks first, then anything due today"
            action={<Button asChild variant="ghost" size="sm"><Link href="/tasks">All tasks</Link></Button>}
          />
          {focus.length ? (
            <ul className="divide-y divide-border">
              {focus.map((t) => (
                <li key={t.id}>
                  <Link href={`/tasks?edit=${t.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2">
                    <PriorityMark priority={t.priority} compact />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{t.title}</span>
                      <span className="text-[12px] text-muted">
                        {t.category}, due {formatDate(t.due_date, profile.date_format)}
                      </span>
                    </span>
                    {t.is_demo && <DemoBadge />}
                    <StatusLight status={t.status} overdue={isOverdue(t, today)} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={CalendarClock}
              title="Nothing due today"
              description={inProgress.length ? `You have ${inProgress.length} task${inProgress.length === 1 ? "" : "s"} in progress.` : "Plan something to work on."}
              action={<Button asChild size="sm" variant="secondary"><Link href="/tasks?new=1"><Plus /> Add a task</Link></Button>}
            />
          )}
        </Panel>

        <Panel>
          <PanelHeader title="Last 7 days" description={`${weekTotal} task${weekTotal === 1 ? "" : "s"} completed, ${loggedDays.size} of 7 days logged`} />
          <PanelBody className="pt-3">
            <WeeklyChart data={chart} />
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader
            title="Recent troubleshooting"
            action={<Button asChild variant="ghost" size="sm"><Link href="/knowledge">Knowledge base</Link></Button>}
          />
          {records.length ? (
            <ul className="divide-y divide-border">
              {records.map((r) => (
                <li key={r.id}>
                  <Link href={`/knowledge/${r.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2">
                    <Led tone={r.status === "resolved" ? "ok" : "warn"} pulse={r.status === "investigating"} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{r.title}</span>
                      <span className="text-[12px] text-muted">
                        {r.category}, {formatDate(localDateOf(r.created_at, tz), profile.date_format)}
                      </span>
                    </span>
                    {r.is_demo && <DemoBadge />}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={BookOpen}
              title="No troubleshooting records yet"
              description="Document the next problem you solve, from symptoms to fix."
              action={<Button asChild size="sm" variant="secondary"><Link href="/knowledge/new"><Plus /> New record</Link></Button>}
            />
          )}
        </Panel>

        <Panel>
          <PanelHeader
            title="Skills you're building"
            action={<Button asChild variant="ghost" size="sm"><Link href="/learning">Tracker</Link></Button>}
          />
          {skills.length ? (
            <ul className="divide-y divide-border">
              {skills.map((s) => (
                <li key={s.id} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-sm font-medium">{s.name}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      {s.is_demo && <DemoBadge />}
                      <Badge tone={s.status === "completed" ? "ok" : "accent"}>{labelFor(SKILL_STATUSES, s.status)}</Badge>
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <Progress value={s.current_level} max={s.target_level} tone={s.status === "completed" ? "ok" : "accent"} label={`${s.name} progress`} />
                    <span className="shrink-0 text-[12px] tabular-nums text-muted">
                      {s.current_level}/{s.target_level}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={GraduationCap}
              title="No skills in progress"
              description="Add what you're learning and set a target level."
              action={<Button asChild size="sm" variant="secondary"><Link href="/learning"><Plus /> Add a skill</Link></Button>}
            />
          )}
        </Panel>
      </div>

      <div className="mt-6 flex flex-wrap gap-2 text-sm">
        <Button asChild variant="ghost" size="sm"><Link href="/worklog/new"><NotebookPen /> Write today&apos;s log</Link></Button>
        <Button asChild variant="ghost" size="sm"><Link href="/reports"><ListChecks /> Today&apos;s report</Link></Button>
      </div>
    </>
  );
}
