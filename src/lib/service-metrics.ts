// Service-desk metrics computed only from stored ticket timestamps.
// Pure functions: no database access, so they're unit-tested directly.

import { addDays, localDateOf, weekRange } from "./dates";
import { ACTIVE_STATUSES, ticketSla, type Ticket, type TicketPriority } from "./tickets";

export type MetricTicket = Pick<
  Ticket,
  | "id"
  | "status"
  | "priority"
  | "category"
  | "client_id"
  | "assignee_id"
  | "created_at"
  | "first_response_due_at"
  | "resolution_due_at"
  | "first_responded_at"
  | "resolved_at"
  | "closed_at"
>;

export interface Period {
  from: number; // ms, inclusive
  to: number; // ms, exclusive
}

const within = (iso: string | null, p: Period) => !!iso && Date.parse(iso) >= p.from && Date.parse(iso) < p.to;
const minutesBetween = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 60_000;
const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

export interface Compliance {
  met: number;
  missed: number;
  pending: number;
  /** null when no target in the group has a known outcome yet. */
  pct: number | null;
}

/**
 * SLA compliance for tickets created in the period. A target counts as met or
 * missed only when the timestamps prove it: done before/after the deadline, or
 * still not done after the deadline passed. Targets still running are "pending".
 */
export function compliance(tickets: MetricTicket[], kind: "response" | "resolution", now: number): Compliance {
  let met = 0;
  let missed = 0;
  let pending = 0;
  for (const t of tickets) {
    const sla = ticketSla(t, now);
    const state = kind === "response" ? sla.response.state : sla.resolution.state;
    if (state === "met") met++;
    else if (state === "missed" || state === "breached") missed++;
    else if (state === "on_track" || state === "at_risk") pending++;
  }
  return { met, missed, pending, pct: met + missed ? Math.round((met / (met + missed)) * 1000) / 10 : null };
}

export interface GroupRow {
  key: string;
  created: number;
  resolved: number;
  open: number;
  avgResolutionMin: number | null;
  resolutionCompliance: number | null;
}

function group(tickets: MetricTicket[], keyOf: (t: MetricTicket) => string | null, p: Period, now: number): GroupRow[] {
  const keys = new Map<string, MetricTicket[]>();
  for (const t of tickets) {
    const k = keyOf(t) ?? "";
    if (!keys.has(k)) keys.set(k, []);
    keys.get(k)!.push(t);
  }
  return [...keys.entries()].map(([key, list]) => {
    const created = list.filter((t) => within(t.created_at, p));
    const resolved = list.filter((t) => within(t.resolved_at, p));
    return {
      key,
      created: created.length,
      resolved: resolved.length,
      open: list.filter((t) => ACTIVE_STATUSES.includes(t.status)).length,
      avgResolutionMin: avg(resolved.map((t) => minutesBetween(t.created_at, t.resolved_at!))),
      resolutionCompliance: compliance(created, "resolution", now).pct,
    };
  });
}

export interface ServiceSummary {
  created: number;
  resolved: number;
  closed: number;
  avgFirstResponseMin: number | null;
  avgResolutionMin: number | null;
  responseCompliance: Compliance;
  resolutionCompliance: Compliance;
  queue: Record<"open" | "in_progress" | "waiting" | "resolved" | "closed", number>;
  overdueNow: number;
  atRiskNow: number;
  byPriority: GroupRow[];
  byCategory: GroupRow[];
  byTechnician: GroupRow[];
  byClient: GroupRow[];
}

/** Everything the overview and reports need, for one period. */
export function summarise(tickets: MetricTicket[], p: Period, now: number = Date.now()): ServiceSummary {
  const created = tickets.filter((t) => within(t.created_at, p));
  const resolved = tickets.filter((t) => within(t.resolved_at, p));
  const responded = created.filter((t) => t.first_responded_at);
  const live = tickets.filter((t) => ACTIVE_STATUSES.includes(t.status));
  const priorityOrder: TicketPriority[] = ["critical", "high", "medium", "low"];
  const byPriority = group(tickets, (t) => t.priority, p, now).sort((a, b) => priorityOrder.indexOf(a.key as TicketPriority) - priorityOrder.indexOf(b.key as TicketPriority));
  return {
    created: created.length,
    resolved: resolved.length,
    closed: tickets.filter((t) => within(t.closed_at, p)).length,
    avgFirstResponseMin: avg(responded.map((t) => minutesBetween(t.created_at, t.first_responded_at!))),
    avgResolutionMin: avg(resolved.map((t) => minutesBetween(t.created_at, t.resolved_at!))),
    responseCompliance: compliance(created, "response", now),
    resolutionCompliance: compliance(created, "resolution", now),
    queue: {
      open: tickets.filter((t) => t.status === "open").length,
      in_progress: tickets.filter((t) => t.status === "in_progress").length,
      waiting: tickets.filter((t) => t.status === "waiting_customer" || t.status === "waiting_third_party").length,
      resolved: tickets.filter((t) => t.status === "resolved").length,
      closed: tickets.filter((t) => t.status === "closed").length,
    },
    overdueNow: live.filter((t) => ticketSla(t, now).overall === "breached").length,
    atRiskNow: live.filter((t) => ticketSla(t, now).overall === "at_risk").length,
    byPriority,
    byCategory: group(tickets, (t) => t.category, p, now).filter((r) => r.created || r.resolved || r.open).sort((a, b) => b.created - a.created),
    byTechnician: group(tickets, (t) => t.assignee_id, p, now).filter((r) => r.created || r.resolved || r.open),
    byClient: group(tickets, (t) => t.client_id, p, now).filter((r) => r.created || r.resolved || r.open).sort((a, b) => b.created - a.created),
  };
}

export type Granularity = "day" | "week" | "month";

export interface Bucket {
  key: string; // yyyy-MM-dd of the bucket start
  label: string;
  created: number;
  resolved: number;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function bucketKey(localDate: string, g: Granularity): string {
  if (g === "day") return localDate;
  if (g === "week") return weekRange(localDate).start;
  return `${localDate.slice(0, 7)}-01`;
}

function nextKey(key: string, g: Granularity): string {
  if (g === "day") return addDays(key, 1);
  if (g === "week") return addDays(key, 7);
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
}

/** Created and resolved counts per day/week/month between two local dates, in a time zone. */
export function timeSeries(tickets: MetricTicket[], startDate: string, endDate: string, g: Granularity, tz: string): Bucket[] {
  const buckets: Bucket[] = [];
  const first = bucketKey(startDate, g);
  const last = bucketKey(endDate, g);
  for (let k = first; k <= last; k = nextKey(k, g)) {
    const [, m, d] = k.split("-").map(Number);
    const label = g === "month" ? `${MONTHS[m - 1]} ${k.slice(2, 4)}` : `${d} ${MONTHS[m - 1]}`;
    buckets.push({ key: k, label, created: 0, resolved: 0 });
    if (buckets.length > 400) break;
  }
  const index = new Map(buckets.map((b, i) => [b.key, i]));
  const place = (iso: string | null, field: "created" | "resolved") => {
    if (!iso) return;
    const local = localDateOf(iso, tz);
    if (local < startDate || local > endDate) return;
    const i = index.get(bucketKey(local, g));
    if (i !== undefined) buckets[i][field]++;
  };
  for (const t of tickets) {
    place(t.created_at, "created");
    place(t.resolved_at, "resolved");
  }
  return buckets;
}

export function formatDuration(min: number | null): string {
  if (min === null) return "—";
  if (min < 60) return `${Math.max(1, Math.round(min))} min`;
  if (min < 48 * 60) return `${(min / 60).toFixed(1).replace(/\.0$/, "")} h`;
  return `${(min / 1440).toFixed(1).replace(/\.0$/, "")} d`;
}
