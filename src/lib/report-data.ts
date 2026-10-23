import "server-only";
import { createClient } from "./supabase/server";
import { utcRangeForDates } from "./dates";
import { buildReport, type Report } from "./reports";
import type { Profile, Skill, Task, TroubleshootingRecord, WorkLog } from "./types";

/** Loads exactly the rows a report needs for [start, end] and builds it. */
export async function loadReport(kind: "daily" | "weekly", start: string, end: string, profile: Profile): Promise<{ report: Report; error: boolean }> {
  const supabase = await createClient();
  const { from, to } = utcRangeForDates(start, end, profile.timezone);

  const [completed, inProgress, openDue, created, logs, records, skills] = await Promise.all([
    supabase.from("tasks").select("title,category,completion_notes,completed_at,priority").eq("status", "completed").gte("completed_at", from).lt("completed_at", to).order("completed_at"),
    supabase.from("tasks").select("title,category,due_date").eq("status", "in_progress").order("due_date", { nullsFirst: false }),
    supabase.from("tasks").select("title,due_date,status").neq("status", "completed").lte("due_date", end).order("due_date"),
    supabase.from("tasks").select("created_at").gte("created_at", from).lt("created_at", to),
    supabase.from("work_logs").select("*").gte("log_date", start).lte("log_date", end),
    supabase.from("troubleshooting_records").select("title,category,status,created_at").gte("created_at", from).lt("created_at", to).order("created_at"),
    supabase.from("skills").select("name,kind,completed_on").eq("status", "completed").gte("completed_on", start).lte("completed_on", end),
  ]);

  const error = [completed, inProgress, openDue, created, logs, records, skills].some((r) => r.error);
  const report = buildReport({
    kind,
    start,
    end,
    tz: profile.timezone,
    dateFormat: profile.date_format,
    completed: (completed.data ?? []) as Task[],
    inProgress: (inProgress.data ?? []) as Task[],
    openDue: (openDue.data ?? []) as Task[],
    created: (created.data ?? []) as Task[],
    logs: (logs.data ?? []) as WorkLog[],
    records: (records.data ?? []) as TroubleshootingRecord[],
    skillsCompleted: (skills.data ?? []) as Skill[],
  });
  return { report, error };
}
