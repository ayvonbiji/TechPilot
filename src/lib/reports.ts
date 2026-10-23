import { daysBetween, formatDate, localDateOf, longDate, shortDay } from "./dates";
import type { DateFormat, Skill, Task, TroubleshootingRecord, WorkLog } from "./types";

/**
 * Report building is pure: it only reorganises rows that were saved in the database.
 * Nothing is inferred or invented. Empty sections say so explicitly.
 */

export interface ReportInput {
  kind: "daily" | "weekly";
  start: string; // yyyy-MM-dd (local)
  end: string;
  tz: string;
  dateFormat: DateFormat;
  completed: Pick<Task, "title" | "category" | "completion_notes" | "completed_at" | "priority">[];
  inProgress: Pick<Task, "title" | "category" | "due_date">[];
  openDue: Pick<Task, "title" | "due_date" | "status">[]; // open tasks due on or before the period end
  created: Pick<Task, "created_at">[];
  logs: WorkLog[];
  records: Pick<TroubleshootingRecord, "title" | "category" | "status" | "created_at">[];
  skillsCompleted: Pick<Skill, "name" | "kind" | "completed_on">[];
}

export interface ReportStats {
  completed: number;
  created: number;
  inProgress: number;
  openDue: number;
  overdue: number;
  completionRate: number | null; // completed / (completed + still-open tasks due in the period)
  daysLogged: number;
  days: number;
  perDay: { date: string; day: string; completed: number; logged: boolean }[];
}

export interface ReportSection {
  title: string;
  items: string[];
}

export interface Report {
  title: string;
  subtitle: string;
  stats: ReportStats;
  sections: ReportSection[];
}

/** Split free text into bullet items, stripping list markers people type. */
export function toItems(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim())
    .filter(Boolean);
}

function unique(items: string[]): string[] {
  const seen = new Set<string>();
  return items.filter((i) => {
    const k = i.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function buildReport(input: ReportInput): Report {
  const { start, end, tz, dateFormat } = input;
  const days = daysBetween(start, end);
  const inPeriod = (instant: string | null) => !!instant && localDateOf(instant, tz) >= start && localDateOf(instant, tz) <= end;

  const completed = input.completed.filter((t) => inPeriod(t.completed_at));
  const logs = input.logs.filter((l) => l.log_date >= start && l.log_date <= end).sort((a, b) => a.log_date.localeCompare(b.log_date));
  const records = input.records.filter((r) => inPeriod(r.created_at));
  const created = input.created.filter((t) => inPeriod(t.created_at)).length;
  const openDueInPeriod = input.openDue.filter((t) => t.due_date && t.due_date >= start && t.due_date <= end);
  const overdue = input.openDue.filter((t) => t.due_date && t.due_date < end);
  const skills = input.skillsCompleted.filter((s) => s.completed_on && s.completed_on >= start && s.completed_on <= end);

  const denominator = completed.length + openDueInPeriod.length;
  const stats: ReportStats = {
    completed: completed.length,
    created,
    inProgress: input.inProgress.length,
    openDue: openDueInPeriod.length,
    overdue: overdue.length,
    completionRate: denominator ? Math.round((completed.length / denominator) * 100) : null,
    daysLogged: new Set(logs.map((l) => l.log_date)).size,
    days: days.length,
    perDay: days.map((d) => ({
      date: d,
      day: shortDay(d),
      completed: completed.filter((t) => t.completed_at && localDateOf(t.completed_at, tz) === d).length,
      logged: logs.some((l) => l.log_date === d),
    })),
  };

  const prefix = (l: WorkLog, item: string) => (input.kind === "weekly" ? `${shortDay(l.log_date)}: ${item}` : item);
  const fromLogs = (key: keyof WorkLog) => unique(logs.flatMap((l) => toItems(String(l[key] ?? "")).map((i) => prefix(l, i))));

  const sections: ReportSection[] = [
    {
      title: `Tasks completed (${completed.length})`,
      items: completed.map((t) => {
        const notes = t.completion_notes.trim().replace(/\s+/g, " ");
        const when = input.kind === "weekly" && t.completed_at ? `${shortDay(localDateOf(t.completed_at, tz))}: ` : "";
        return `${when}${t.title} [${t.category}]${notes ? `: ${notes}` : ""}`;
      }),
    },
    {
      title: `Work in progress (${input.inProgress.length})`,
      items: input.inProgress.map((t) => `${t.title} [${t.category}]${t.due_date ? `, due ${formatDate(t.due_date, dateFormat)}` : ""}`),
    },
    { title: "Tasks performed", items: fromLogs("tasks_performed") },
    {
      title: "Technical problems investigated",
      items: unique([
        ...fromLogs("problems_investigated"),
        ...records.map((r) => `${r.title} [${r.category}, ${r.status === "resolved" ? "resolved" : "still investigating"}] (knowledge base)`),
      ]),
    },
    { title: "Solutions and outcomes", items: fromLogs("solutions_outcomes") },
    {
      title: "Skills learned",
      items: unique([
        ...fromLogs("skills_learned"),
        ...skills.map((s) => `Completed ${s.kind === "certification" ? "certification" : "skill"}: ${s.name}`),
      ]),
    },
    { title: "Challenges", items: fromLogs("challenges") },
    {
      title: "Pending follow-ups",
      items: unique([
        ...fromLogs("follow_up_actions"),
        ...overdue.map((t) => `Overdue task: ${t.title} (due ${formatDate(t.due_date, dateFormat)})`),
        ...openDueInPeriod
          .filter((t) => !overdue.includes(t))
          .map((t) => `Open task due ${formatDate(t.due_date, dateFormat)}: ${t.title}`),
      ]),
    },
  ];

  return input.kind === "daily"
    ? { title: "Daily work summary", subtitle: longDate(start), stats, sections }
    : {
        title: "Weekly work summary",
        subtitle: `${formatDate(start, dateFormat)} to ${formatDate(end, dateFormat)}`,
        stats,
        sections,
      };
}

/** Plain-text/Markdown rendering used for the editable draft, copy and download. */
export function reportToText(report: Report, generatedOn: string): string {
  const s = report.stats;
  const lines: string[] = [`# ${report.title}`, report.subtitle, ""];
  if (report.title.startsWith("Weekly")) {
    lines.push("## Weekly statistics");
    lines.push(`- Tasks completed: ${s.completed}`);
    lines.push(`- Tasks created: ${s.created}`);
    lines.push(`- Completion rate for tasks due this week: ${s.completionRate === null ? "no tasks were due" : `${s.completionRate}%`}`);
    lines.push(`- Days with a work log: ${s.daysLogged} of ${s.days}`);
    lines.push(`- Completed per day: ${s.perDay.map((d) => `${d.day} ${d.completed}`).join(", ")}`);
    lines.push("");
  }
  for (const section of report.sections) {
    lines.push(`## ${section.title}`);
    if (section.items.length) section.items.forEach((i) => lines.push(`- ${i}`));
    else lines.push("- Nothing recorded");
    lines.push("");
  }
  lines.push(`_Generated from saved tasks, work logs and records on ${generatedOn}._`);
  return lines.join("\n");
}

/** RFC 4180 CSV with formula-injection protection for spreadsheet apps. */
export function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const cell = (v: unknown) => {
    let s = v === null || v === undefined ? "" : Array.isArray(v) ? v.join("; ") : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.join(","), ...rows.map((r) => columns.map((c) => cell(r[c])).join(","))].join("\r\n");
}
