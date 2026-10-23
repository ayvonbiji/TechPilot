// Ticket constants and pure helpers. The status workflow mirrors
// public.ticket_transition_allowed() in the database, which is the real guard.

export type TicketStatus = "open" | "in_progress" | "waiting_customer" | "waiting_third_party" | "resolved" | "closed";
export type TicketPriority = "low" | "medium" | "high" | "critical";

export interface Ticket {
  id: string;
  workspace_id: string;
  number: number;
  reference: string;
  subject: string;
  description: string;
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  requester_id: string | null;
  requester_name: string;
  requester_email: string;
  client_id: string | null;
  assignee_id: string | null;
  kb_article_id: string | null;
  resolution_summary: string;
  first_response_due_at: string | null;
  resolution_due_at: string | null;
  first_responded_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  reopened_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TicketComment {
  id: string;
  ticket_id: string;
  author_id: string | null;
  author_name: string;
  author_is_staff: boolean;
  body: string;
  is_internal: boolean;
  created_at: string;
}

export interface TicketEvent {
  id: number;
  ticket_id: string;
  actor_id: string | null;
  actor_name: string;
  kind: "created" | "status" | "priority" | "assignee" | "client" | "category" | "kb_link" | "sla";
  from_value: string | null;
  to_value: string | null;
  is_public: boolean;
  created_at: string;
}

export const TICKET_STATUSES: { value: TicketStatus; label: string; short: string }[] = [
  { value: "open", label: "Open", short: "Open" },
  { value: "in_progress", label: "In progress", short: "In progress" },
  { value: "waiting_customer", label: "Waiting for customer", short: "Waiting: customer" },
  { value: "waiting_third_party", label: "Waiting for third party", short: "Waiting: third party" },
  { value: "resolved", label: "Resolved", short: "Resolved" },
  { value: "closed", label: "Closed", short: "Closed" },
];

export const ACTIVE_STATUSES: TicketStatus[] = ["open", "in_progress", "waiting_customer", "waiting_third_party"];

export const TICKET_PRIORITIES: { value: TicketPriority; label: string; rank: number }[] = [
  { value: "critical", label: "Critical", rank: 0 },
  { value: "high", label: "High", rank: 1 },
  { value: "medium", label: "Medium", rank: 2 },
  { value: "low", label: "Low", rank: 3 },
];

export const TICKET_CATEGORIES = [
  "General support",
  "Hardware",
  "Software",
  "Network and connectivity",
  "Email and Microsoft 365",
  "Printers",
  "Accounts and access",
  "Security",
  "Server and infrastructure",
  "Request for service",
] as const;

export const statusLabel = (s: string) => TICKET_STATUSES.find((x) => x.value === s)?.label ?? s;
export const priorityLabel = (p: string) => TICKET_PRIORITIES.find((x) => x.value === p)?.label ?? p;
export const priorityRank = (p: string) => TICKET_PRIORITIES.find((x) => x.value === p)?.rank ?? 9;

const TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  open: ["in_progress", "waiting_customer", "waiting_third_party", "resolved"],
  in_progress: ["waiting_customer", "waiting_third_party", "resolved"],
  waiting_customer: ["in_progress", "resolved"],
  waiting_third_party: ["in_progress", "resolved"],
  resolved: ["closed", "in_progress"],
  closed: ["in_progress"],
};

/** Statuses a ticket may move to next. Reopening a closed ticket needs an admin. */
export function nextStatuses(current: TicketStatus, isAdmin: boolean): TicketStatus[] {
  if (current === "closed" && !isAdmin) return [];
  return TRANSITIONS[current] ?? [];
}

export function canTransition(from: TicketStatus, to: TicketStatus, isAdmin: boolean): boolean {
  return from === to || nextStatuses(from, isAdmin).includes(to);
}

export const isReopen = (from: TicketStatus, to: TicketStatus) =>
  (from === "resolved" || from === "closed") && to !== "resolved" && to !== "closed";

// ---------------------------------------------------------------- SLA

export type SlaState = "none" | "on_track" | "at_risk" | "breached" | "met" | "missed";

export interface SlaTarget {
  state: SlaState;
  due: string | null;
  doneAt: string | null;
}

/**
 * State of one SLA target, from stored timestamps only.
 * "At risk" means less than 25% of the target time remains (at least 15 minutes),
 * matching the database's SLA sweep.
 */
export function slaTarget(createdAt: string, due: string | null, doneAt: string | null, now: number = Date.now()): SlaTarget {
  if (!due) return { state: "none", due: null, doneAt };
  const dueMs = Date.parse(due);
  if (doneAt) return { state: Date.parse(doneAt) <= dueMs ? "met" : "missed", due, doneAt };
  if (now > dueMs) return { state: "breached", due, doneAt: null };
  const span = Math.max((dueMs - Date.parse(createdAt)) * 0.25, 15 * 60_000);
  return { state: dueMs - now < span ? "at_risk" : "on_track", due, doneAt: null };
}

export function ticketSla(t: Pick<Ticket, "created_at" | "first_response_due_at" | "first_responded_at" | "resolution_due_at" | "resolved_at" | "closed_at">, now: number = Date.now()) {
  const response = slaTarget(t.created_at, t.first_response_due_at, t.first_responded_at, now);
  const resolution = slaTarget(t.created_at, t.resolution_due_at, t.resolved_at ?? t.closed_at, now);
  // Worst live state for list views.
  const order: SlaState[] = ["breached", "at_risk", "on_track", "missed", "met", "none"];
  const live = [response.state, resolution.state];
  const overall = order.find((s) => live.includes(s)) ?? "none";
  return { response, resolution, overall };
}

export const SLA_LABELS: Record<SlaState, string> = {
  none: "No target",
  on_track: "On track",
  at_risk: "Due soon",
  breached: "Overdue",
  met: "Met",
  missed: "Missed",
};

/** "in 3 h", "2 d ago" — compact relative time for deadlines. */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const diff = Date.parse(iso) - now;
  const abs = Math.abs(diff);
  const m = Math.round(abs / 60_000);
  const text = m < 60 ? `${Math.max(m, 1)} min` : m < 60 * 48 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`;
  return diff >= 0 ? `in ${text}` : `${text} ago`;
}

export function formatMinutes(min: number | null): string {
  if (min === null) return "No target";
  if (min < 60) return `${min} min`;
  if (min % 1440 === 0) return `${min / 1440} day${min === 1440 ? "" : "s"}`;
  if (min % 60 === 0) return `${min / 60} h`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
}
