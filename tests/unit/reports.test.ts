import { describe, expect, it } from "vitest";
import { buildReport, reportToText, toCsv, toItems, type ReportInput } from "@/lib/reports";
import type { WorkLog } from "@/lib/types";

const log = (date: string, fields: Partial<WorkLog>): WorkLog => ({
  id: date,
  user_id: "u",
  is_demo: false,
  created_at: "",
  updated_at: "",
  log_date: date,
  tasks_performed: "",
  problems_investigated: "",
  solutions_outcomes: "",
  skills_learned: "",
  challenges: "",
  follow_up_actions: "",
  reflections: "",
  ...fields,
});

function input(over: Partial<ReportInput> = {}): ReportInput {
  return {
    kind: "daily",
    start: "2026-10-23",
    end: "2026-10-23",
    tz: "UTC",
    dateFormat: "dd MMM yyyy",
    completed: [],
    inProgress: [],
    openDue: [],
    created: [],
    logs: [],
    records: [],
    skillsCompleted: [],
    ...over,
  };
}

describe("reports", () => {
  it("strips list markers from free text", () => {
    expect(toItems("- one\n* two\n3. three\n\n  four  ")).toEqual(["one", "two", "three", "four"]);
  });

  it("never invents content: an empty day reports nothing recorded", () => {
    const text = reportToText(buildReport(input()), "now");
    expect(text).toContain("## Tasks completed (0)");
    expect(text.match(/Nothing recorded/g)?.length).toBe(8);
  });

  it("only includes tasks completed inside the period (time-zone aware)", () => {
    const r = buildReport(
      input({
        tz: "Asia/Kolkata",
        completed: [
          { title: "In period", category: "General", completion_notes: "", completed_at: "2026-10-23T10:00:00Z", priority: "low" },
          // 20:00 UTC on the 23rd is the 24th in India
          { title: "Next day locally", category: "General", completion_notes: "", completed_at: "2026-10-23T20:00:00Z", priority: "low" },
        ],
      }),
    );
    expect(r.sections[0].items).toEqual(["In period [General]"]);
    expect(r.stats.completed).toBe(1);
  });

  it("collects problems, skills and follow-ups from logs and records", () => {
    const r = buildReport(
      input({
        logs: [log("2026-10-23", { problems_investigated: "DNS failing", skills_learned: "- nslookup", follow_up_actions: "Check DHCP scope" })],
        records: [{ title: "Printer offline", category: "Printers and scanners", status: "resolved", created_at: "2026-10-23T09:00:00Z" }],
        openDue: [{ title: "Old task", due_date: "2026-10-20", status: "pending" }],
      }),
    );
    const byTitle = Object.fromEntries(r.sections.map((s) => [s.title.replace(/ \(\d+\)$/, ""), s.items]));
    expect(byTitle["Technical problems investigated"]).toEqual([
      "DNS failing",
      "Printer offline [Printers and scanners, resolved] (knowledge base)",
    ]);
    expect(byTitle["Skills learned"]).toEqual(["nslookup"]);
    expect(byTitle["Pending follow-ups"]).toEqual(["Check DHCP scope", "Overdue task: Old task (due 20 Oct 2026)"]);
  });

  it("computes weekly completion rate from tasks due in the week", () => {
    const r = buildReport(
      input({
        kind: "weekly",
        start: "2026-10-19",
        end: "2026-10-25",
        completed: [{ title: "A", category: "G", completion_notes: "", completed_at: "2026-10-20T10:00:00Z", priority: "low" }],
        openDue: [{ title: "B", due_date: "2026-10-24", status: "pending" }],
        logs: [log("2026-10-20", { tasks_performed: "x" }), log("2026-10-21", { tasks_performed: "y" })],
      }),
    );
    expect(r.stats.completionRate).toBe(50);
    expect(r.stats.daysLogged).toBe(2);
    expect(r.stats.perDay).toHaveLength(7);
    expect(r.sections[0].items[0]).toBe("Tue: A [G]");
  });

  it("returns null completion rate when nothing was due", () => {
    expect(buildReport(input()).stats.completionRate).toBeNull();
  });
});

describe("csv", () => {
  it("quotes commas, quotes and newlines", () => {
    expect(toCsv([{ a: 'x,"y"\nz' }], ["a"])).toBe('a\r\n"x,""y""\nz"');
  });
  it("neutralises spreadsheet formula injection", () => {
    expect(toCsv([{ a: "=HYPERLINK(1)" }, { a: "+1" }, { a: "-2" }, { a: "@x" }], ["a"]).split("\r\n").slice(1)).toEqual([
      "'=HYPERLINK(1)",
      "'+1",
      "'-2",
      "'@x",
    ]);
  });
});
