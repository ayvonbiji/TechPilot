import { describe, expect, it } from "vitest";
import { canTransition, nextStatuses, slaTarget, ticketSla, isReopen, formatMinutes } from "@/lib/tickets";
import { compliance, summarise, timeSeries, type MetricTicket } from "@/lib/service-metrics";

const T0 = Date.parse("2026-10-20T09:00:00Z");
const iso = (minsAfterT0: number) => new Date(T0 + minsAfterT0 * 60_000).toISOString();

function ticket(over: Partial<MetricTicket> = {}): MetricTicket {
  return {
    id: Math.random().toString(36),
    status: "open",
    priority: "medium",
    category: "General support",
    client_id: null,
    assignee_id: null,
    created_at: iso(0),
    first_response_due_at: iso(60),
    resolution_due_at: iso(240),
    first_responded_at: null,
    resolved_at: null,
    closed_at: null,
    ...over,
  };
}

describe("ticket workflow (mirrors the database)", () => {
  it("allows the documented path", () => {
    expect(canTransition("open", "in_progress", false)).toBe(true);
    expect(canTransition("in_progress", "waiting_customer", false)).toBe(true);
    expect(canTransition("waiting_customer", "in_progress", false)).toBe(true);
    expect(canTransition("in_progress", "resolved", false)).toBe(true);
    expect(canTransition("resolved", "closed", false)).toBe(true);
  });
  it("blocks shortcuts", () => {
    expect(canTransition("open", "closed", true)).toBe(false);
    expect(canTransition("waiting_third_party", "waiting_customer", true)).toBe(false);
    expect(canTransition("in_progress", "open", true)).toBe(false);
  });
  it("lets anyone reopen resolved, only admins reopen closed", () => {
    expect(canTransition("resolved", "in_progress", false)).toBe(true);
    expect(canTransition("closed", "in_progress", false)).toBe(false);
    expect(canTransition("closed", "in_progress", true)).toBe(true);
    expect(nextStatuses("closed", false)).toEqual([]);
    expect(isReopen("closed", "in_progress")).toBe(true);
    expect(isReopen("in_progress", "resolved")).toBe(false);
  });
});

describe("SLA states", () => {
  it("reports no target when there is no deadline", () => {
    expect(slaTarget(iso(0), null, null, T0).state).toBe("none");
  });
  it("is on track, then due soon in the last 25%, then overdue", () => {
    expect(slaTarget(iso(0), iso(240), null, T0 + 60 * 60_000).state).toBe("on_track");
    expect(slaTarget(iso(0), iso(240), null, T0 + 200 * 60_000).state).toBe("at_risk");
    expect(slaTarget(iso(0), iso(240), null, T0 + 241 * 60_000).state).toBe("breached");
  });
  it("uses a 15-minute minimum warning window", () => {
    expect(slaTarget(iso(0), iso(20), null, T0 + 6 * 60_000).state).toBe("at_risk");
  });
  it("is met or missed only from the completion timestamp", () => {
    expect(slaTarget(iso(0), iso(60), iso(59), T0 + 9999 * 60_000).state).toBe("met");
    expect(slaTarget(iso(0), iso(60), iso(61), T0).state).toBe("missed");
  });
  it("uses closed_at when a ticket was closed without a resolved_at", () => {
    const s = ticketSla(ticket({ closed_at: iso(100) }), T0 + 9999 * 60_000);
    expect(s.resolution.state).toBe("met");
  });
  it("formats targets", () => {
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(240)).toBe("4 h");
    expect(formatMinutes(1440)).toBe("1 day");
    expect(formatMinutes(4320)).toBe("3 days");
    expect(formatMinutes(90)).toBe("1 h 30 min");
    expect(formatMinutes(null)).toBe("No target");
  });
});

describe("service metrics", () => {
  const now = T0 + 10 * 24 * 60 * 60_000; // ten days later
  const period = { from: T0 - 1, to: T0 + 7 * 24 * 60 * 60_000 };

  it("counts compliance only for targets with a known outcome", () => {
    const c = compliance(
      [
        ticket({ first_responded_at: iso(30) }), // met
        ticket({ first_responded_at: iso(90) }), // missed
        ticket({}), // never answered, deadline passed: missed
        ticket({ first_response_due_at: null }), // no target: ignored
      ],
      "response",
      now,
    );
    expect(c).toEqual({ met: 1, missed: 2, pending: 0, pct: 33.3 });
  });

  it("keeps running targets out of the percentage", () => {
    const c = compliance([ticket({})], "response", T0 + 10 * 60_000);
    expect(c).toEqual({ met: 0, missed: 0, pending: 1, pct: null });
  });

  it("summarises averages, queue and groups", () => {
    const s = summarise(
      [
        ticket({ status: "resolved", priority: "high", first_responded_at: iso(30), resolved_at: iso(120), assignee_id: "a" }),
        ticket({ status: "in_progress", priority: "critical", first_responded_at: iso(90), assignee_id: "a" }),
        ticket({ status: "open", created_at: iso(-60 * 24 * 30), first_response_due_at: null, resolution_due_at: null }), // outside period
      ],
      period,
      now,
    );
    expect(s.created).toBe(2);
    expect(s.resolved).toBe(1);
    expect(s.avgFirstResponseMin).toBe(60);
    expect(s.avgResolutionMin).toBe(120);
    expect(s.queue).toEqual({ open: 1, in_progress: 1, waiting: 0, resolved: 1, closed: 0 });
    expect(s.overdueNow).toBe(1);
    expect(s.byPriority.map((r) => r.key)).toEqual(["critical", "high", "medium"]);
    const tech = s.byTechnician.find((r) => r.key === "a")!;
    expect(tech).toMatchObject({ created: 2, resolved: 1, open: 1 });
  });

  it("buckets by local day, week and month", () => {
    const list = [ticket({ created_at: "2026-10-20T20:00:00Z", resolved_at: "2026-10-27T10:00:00Z" })];
    const days = timeSeries(list, "2026-10-20", "2026-10-27", "day", "Asia/Kolkata");
    expect(days).toHaveLength(8);
    expect(days.find((b) => b.key === "2026-10-21")?.created).toBe(1); // 20:00 UTC is the 21st in India
    expect(days.find((b) => b.key === "2026-10-27")?.resolved).toBe(1);
    const weeks = timeSeries(list, "2026-10-19", "2026-11-01", "week", "UTC");
    expect(weeks.map((b) => b.key)).toEqual(["2026-10-19", "2026-10-26"]);
    expect(weeks[0].created).toBe(1);
    expect(weeks[1].resolved).toBe(1);
    const months = timeSeries(list, "2026-09-15", "2026-11-02", "month", "UTC");
    expect(months.map((b) => b.key)).toEqual(["2026-09-01", "2026-10-01", "2026-11-01"]);
  });
});
