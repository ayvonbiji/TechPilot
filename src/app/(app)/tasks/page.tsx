import type { Metadata } from "next";
import Link from "next/link";
import { ListChecks, Plus } from "lucide-react";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addDays, formatDate, localDateOf, todayIn, weekRange } from "@/lib/dates";
import { PRIORITIES, TASK_CATEGORIES, TASK_STATUSES } from "@/lib/constants";
import { first, sanitizeSearch, truncate } from "@/lib/utils";
import type { Task } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { DemoBadge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { FilterBar } from "@/components/shared/filter-bar";
import { EmptyState } from "@/components/shared/empty-state";
import { Progress } from "@/components/ui/progress";
import { PriorityMark, StatusLight, isOverdue } from "@/components/tasks/task-indicators";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { CompleteToggle, EditTitleButton, TaskRowActions } from "@/components/tasks/task-row-actions";

export const metadata: Metadata = { title: "My tasks" };

type SP = Promise<Record<string, string | string[] | undefined>>;

const DUE_FILTERS = [
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Due today" },
  { value: "week", label: "Due this week" },
  { value: "upcoming", label: "Later" },
  { value: "none", label: "No due date" },
] as const;

const SORTS = [
  { value: "due", label: "Sort: due date" },
  { value: "priority", label: "Sort: priority" },
  { value: "newest", label: "Sort: newest first" },
  { value: "oldest", label: "Sort: oldest first" },
  { value: "title", label: "Sort: title A–Z" },
] as const;

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 } as const;
const STATUS_RANK = { in_progress: 0, pending: 1, completed: 2 } as const;

export default async function TasksPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const profile = await getProfile();
  const today = todayIn(profile.timezone);
  const week = weekRange(today);
  const supabase = await createClient();

  const q = sanitizeSearch(first(sp.q));
  const status = first(sp.status);
  const priority = first(sp.priority);
  const due = first(sp.due);
  const category = first(sp.category);
  const sort = first(sp.sort) ?? "due";

  let query = supabase.from("tasks").select("*").limit(1000);
  if (q) query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%,category.ilike.%${q}%,completion_notes.ilike.%${q}%`);
  if (status && TASK_STATUSES.some((s) => s.value === status)) query = query.eq("status", status);
  if (priority && PRIORITIES.some((p) => p.value === priority)) query = query.eq("priority", priority);
  if (category) query = query.eq("category", category.slice(0, 60));
  if (due === "overdue") query = query.lt("due_date", today).neq("status", "completed");
  if (due === "today") query = query.eq("due_date", today);
  if (due === "week") query = query.gte("due_date", week.start).lte("due_date", week.end);
  if (due === "upcoming") query = query.gt("due_date", week.end);
  if (due === "none") query = query.is("due_date", null);

  const [{ data, error }, allRes] = await Promise.all([
    query,
    supabase.from("tasks").select("status,due_date,category,completed_at").limit(5000),
  ]);
  const tasks = (data ?? []) as Task[];
  const all = (allRes.data ?? []) as Pick<Task, "status" | "due_date" | "category" | "completed_at">[];

  tasks.sort((a, b) => {
    switch (sort) {
      case "priority":
        return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || STATUS_RANK[a.status] - STATUS_RANK[b.status];
      case "newest":
        return b.created_at.localeCompare(a.created_at);
      case "oldest":
        return a.created_at.localeCompare(b.created_at);
      case "title":
        return a.title.localeCompare(b.title);
      default: {
        // Open tasks first; within them, earliest due date first, undated last.
        const s = (a.status === "completed" ? 1 : 0) - (b.status === "completed" ? 1 : 0);
        if (s) return s;
        if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date) || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
        return a.due_date ? -1 : b.due_date ? 1 : b.created_at.localeCompare(a.created_at);
      }
    }
  });

  const total = all.length;
  const completed = all.filter((t) => t.status === "completed").length;
  const inProgress = all.filter((t) => t.status === "in_progress").length;
  const pendingCount = all.filter((t) => t.status === "pending").length;
  const overdue = all.filter((t) => isOverdue(t, today)).length;
  const doneThisWeek = all.filter((t) => t.completed_at && localDateOf(t.completed_at, profile.timezone) >= week.start).length;
  const categories = Array.from(new Set([...TASK_CATEGORIES, ...all.map((t) => t.category)])).sort();
  const editId = first(sp.edit);
  let editTask: Task | null = null;
  if (editId && !tasks.some((t) => t.id === editId) && /^[0-9a-f-]{36}$/i.test(editId)) {
    const { data: one } = await supabase.from("tasks").select("*").eq("id", editId).maybeSingle();
    editTask = (one as Task | null) ?? null;
  }
  const filtered = Boolean(q || status || priority || due || category);

  return (
    <>
      <PageHeader
        title="My tasks"
        description="Plan, track and close out your work. Overdue tasks are flagged in red."
        actions={<Button asChild><Link href="?new=1" scroll={false}><Plus /> New task</Link></Button>}
      />

      <Panel className="mb-5 grid gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-medium">
              {completed} of {total} completed
            </p>
            <p className="text-[13px] text-muted">{total ? Math.round((completed / total) * 100) : 0}%</p>
          </div>
          <Progress className="mt-2" value={completed} max={Math.max(total, 1)} tone="ok" label="Overall completion" />
        </div>
        <dl className="grid grid-cols-4 gap-4 text-center sm:gap-6">
          {[
            { k: "Pending", v: pendingCount },
            { k: "In progress", v: inProgress },
            { k: "Overdue", v: overdue, danger: overdue > 0 },
            { k: "Done this week", v: doneThisWeek },
          ].map((s) => (
            <div key={s.k}>
              <dt className="text-[12px] text-muted">{s.k}</dt>
              <dd className={`text-lg font-semibold tabular-nums ${s.danger ? "text-danger" : ""}`}>{s.v}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      <FilterBar
        className="mb-4"
        searchPlaceholder="Search tasks"
        filters={[
          { name: "status", label: "Status", options: TASK_STATUSES },
          { name: "priority", label: "Priority", options: PRIORITIES },
          { name: "due", label: "Due", options: DUE_FILTERS },
          { name: "category", label: "Category", options: categories.map((c) => ({ value: c, label: c })) },
        ]}
        sort={{ name: "sort", label: "Sort order", options: SORTS }}
      />

      {error && (
        <p role="alert" className="mb-4 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger">
          Tasks couldn&apos;t be loaded. Refresh to try again.
        </p>
      )}

      <Panel>
        {tasks.length === 0 ? (
          filtered ? (
            <EmptyState icon={ListChecks} title="No tasks match these filters" description="Try a different search or clear the filters." />
          ) : (
            <EmptyState
              icon={ListChecks}
              title="No tasks yet"
              description="Add your first task, like reviewing Windows Event Viewer or practising a printer install."
              action={<Button asChild><Link href="?new=1" scroll={false}><Plus /> New task</Link></Button>}
            />
          )
        ) : (
          <>
            <p className="sr-only" role="status">{tasks.length} tasks shown</p>
            {/* Desktop table */}
            <table className="hidden w-full text-sm md:table">
              <thead>
                <tr className="border-b border-border text-left text-[12px] text-muted">
                  <th className="w-10 py-2.5 pl-5" scope="col"><span className="sr-only">Done</span></th>
                  <th className="py-2.5 pr-3 font-medium" scope="col">Task</th>
                  <th className="py-2.5 pr-3 font-medium" scope="col">Category</th>
                  <th className="py-2.5 pr-3 font-medium" scope="col">Priority</th>
                  <th className="py-2.5 pr-3 font-medium" scope="col">Due</th>
                  <th className="py-2.5 pr-3 font-medium" scope="col">Status</th>
                  <th className="w-12 py-2.5 pr-3" scope="col"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tasks.map((t) => {
                  const late = isOverdue(t, today);
                  return (
                    <tr key={t.id} className={late ? "bg-danger-soft/40" : "hover:bg-surface-2/60"}>
                      <td className="py-3 pl-5 align-top"><div className="pt-0.5"><CompleteToggle task={t} /></div></td>
                      <td className="max-w-0 py-3 pr-3 align-top">
                        <div className="flex items-center gap-2">
                          <EditTitleButton task={t} />
                          {t.is_demo && <DemoBadge />}
                        </div>
                        {t.description && <p className="mt-0.5 truncate text-[13px] text-muted">{truncate(t.description, 140)}</p>}
                        {t.status === "completed" && t.completed_at && (
                          <p className="mt-0.5 text-[12px] text-subtle">
                            Completed {formatDate(localDateOf(t.completed_at, profile.timezone), profile.date_format)}
                          </p>
                        )}
                      </td>
                      <td className="py-3 pr-3 align-top text-[13px] text-muted">{t.category}</td>
                      <td className="py-3 pr-3 align-top"><PriorityMark priority={t.priority} /></td>
                      <td className={`py-3 pr-3 align-top text-[13px] whitespace-nowrap ${late ? "font-medium text-danger" : "text-muted"}`}>
                        {t.due_date ? (t.due_date === today ? "Today" : t.due_date === addDays(today, 1) ? "Tomorrow" : formatDate(t.due_date, profile.date_format)) : "—"}
                      </td>
                      <td className="py-3 pr-3 align-top"><StatusLight status={t.status} overdue={late} /></td>
                      <td className="py-2 pr-3 align-top"><TaskRowActions task={t} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {/* Mobile list */}
            <ul className="divide-y divide-border md:hidden">
              {tasks.map((t) => {
                const late = isOverdue(t, today);
                return (
                  <li key={t.id} className={`flex gap-3 px-4 py-3 ${late ? "bg-danger-soft/40" : ""}`}>
                    <div className="pt-0.5"><CompleteToggle task={t} /></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <EditTitleButton task={t} />
                        <TaskRowActions task={t} />
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
                        <StatusLight status={t.status} overdue={late} />
                        <PriorityMark priority={t.priority} />
                        {t.due_date && <span className={late ? "text-danger" : ""}>Due {formatDate(t.due_date, profile.date_format)}</span>}
                        <span>{t.category}</span>
                        {t.is_demo && <DemoBadge />}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Panel>

      <TaskFormDialog tasks={tasks} today={today} editTask={editTask} />
    </>
  );
}
