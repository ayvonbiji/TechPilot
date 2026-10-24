import "server-only";
import { cache } from "react";
import { createClient } from "./supabase/server";
import { ACTIVE_STATUSES, ticketSla, priorityRank, type Ticket, type TicketComment, type TicketEvent, type TicketStatus } from "./tickets";
import { sanitizeSearch } from "./utils";

export interface Person {
  id: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "agent" | "client";
  clientId: string | null;
}

export interface ClientRow {
  id: string;
  name: string;
  is_active: boolean;
}

/** Everyone in the workspace, for staff (emails included). Empty for non-staff. */
export const getPeople = cache(async (workspaceId: string): Promise<Person[]> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("workspace_roster", { ws: workspaceId });
  return ((data ?? []) as { user_id: string; display_name: string; email: string; role: Person["role"]; client_id: string | null }[]).map((r) => ({
    id: r.user_id,
    name: r.display_name || r.email.split("@")[0],
    email: r.email,
    role: r.role,
    clientId: r.client_id,
  }));
});

/** Names only, for any member (customers see staff and their own colleagues). */
export const getMemberNames = cache(async (workspaceId: string): Promise<Map<string, string>> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("member_names", { ws: workspaceId });
  return new Map(((data ?? []) as { user_id: string; display_name: string }[]).map((r) => [r.user_id, r.display_name]));
});

export const getClients = cache(async (workspaceId: string): Promise<ClientRow[]> => {
  const supabase = await createClient();
  const { data } = await supabase.from("clients").select("id,name,is_active").eq("workspace_id", workspaceId).order("name");
  return (data ?? []) as ClientRow[];
});

export interface TicketFilters {
  q?: string;
  status?: string; // a status, "active" (default) or "all"
  priority?: string;
  client?: string;
  assignee?: string; // user id, "me" or "unassigned"
  sla?: string; // "breached" | "at_risk"
  sort?: string; // "created" | "updated" | "priority" | "sla"
  page?: number;
  pageSize?: number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Tickets in a workspace, filtered and paged on the server. RLS still decides
 * which rows the caller may see; customers get only their organisation's.
 */
export async function listTickets(workspaceId: string, userId: string, f: TicketFilters) {
  const supabase = await createClient();
  const pageSize = f.pageSize ?? 25;
  const page = Math.max(1, f.page ?? 1);
  const q = sanitizeSearch(f.q);

  let query = supabase.from("tickets").select("*", { count: "exact" }).eq("workspace_id", workspaceId);
  const status = f.status ?? "active";
  if (status === "active") query = query.in("status", ACTIVE_STATUSES);
  else if (status !== "all" && ["open", "in_progress", "waiting_customer", "waiting_third_party", "resolved", "closed"].includes(status)) {
    query = query.eq("status", status as TicketStatus);
  }
  if (f.priority && ["low", "medium", "high", "critical"].includes(f.priority)) query = query.eq("priority", f.priority);
  if (f.client === "none") query = query.is("client_id", null);
  else if (f.client && UUID.test(f.client)) query = query.eq("client_id", f.client);
  if (f.assignee === "me") query = query.eq("assignee_id", userId);
  else if (f.assignee === "unassigned") query = query.is("assignee_id", null);
  else if (f.assignee && UUID.test(f.assignee)) query = query.eq("assignee_id", f.assignee);
  if (q) {
    const ref = q.replace(/\s+/g, "").toUpperCase();
    query = query.or(`reference.ilike."%${ref}%",subject.ilike."%${q}%",search.wfts(english)."${q}"`);
  }

  // Priority and SLA ordering need logic PostgREST can't express; sort those in code.
  const sort = f.sort ?? "created";
  const needsAll = Boolean(f.sla) || sort === "priority" || sort === "sla";
  if (sort === "updated") query = query.order("updated_at", { ascending: false });
  else query = query.order("created_at", { ascending: false });

  if (!needsAll) {
    const { data, count, error } = await query.range((page - 1) * pageSize, page * pageSize - 1);
    return { tickets: (data ?? []) as Ticket[], total: count ?? 0, page, pageSize, error: Boolean(error) };
  }

  const { data, error } = await query.limit(2000);
  let rows = (data ?? []) as Ticket[];
  const now = Date.now();
  if (f.sla === "breached") rows = rows.filter((t) => ticketSla(t, now).overall === "breached");
  if (f.sla === "at_risk") rows = rows.filter((t) => ticketSla(t, now).overall === "at_risk");
  if (sort === "priority") {
    rows.sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || b.created_at.localeCompare(a.created_at));
  } else if (sort === "sla") {
    const due = (t: Ticket) => {
      const s = ticketSla(t, now);
      const live = [s.response, s.resolution].filter((x) => ["breached", "at_risk", "on_track"].includes(x.state) && x.due);
      return live.length ? Math.min(...live.map((x) => Date.parse(x.due!))) : Number.MAX_SAFE_INTEGER;
    };
    rows.sort((a, b) => due(a) - due(b));
  }
  return {
    tickets: rows.slice((page - 1) * pageSize, page * pageSize),
    total: rows.length,
    page,
    pageSize,
    error: Boolean(error),
  };
}

export async function getTicketDetail(id: string) {
  if (!UUID.test(id)) return null;
  const supabase = await createClient();
  const { data: ticket } = await supabase.from("tickets").select("*").eq("id", id).maybeSingle();
  if (!ticket) return null;
  const [comments, events] = await Promise.all([
    supabase.from("ticket_comments").select("*").eq("ticket_id", id).order("created_at"),
    supabase.from("ticket_events").select("*").eq("ticket_id", id).order("created_at"),
  ]);
  return {
    ticket: ticket as Ticket,
    comments: (comments.data ?? []) as TicketComment[],
    events: (events.data ?? []) as TicketEvent[],
  };
}

/** Run the SLA sweep for a workspace (creates due-soon/overdue notifications once). */
export async function sweepSla(workspaceId: string) {
  const supabase = await createClient();
  await supabase.rpc("sla_sweep", { ws: workspaceId });
}

/** SLA targets per priority: workspace defaults, plus a client's overrides if given. */
export async function getSlaRows(workspaceId: string, clientId?: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sla_policies")
    .select("priority,client_id,first_response_minutes,resolution_minutes")
    .eq("workspace_id", workspaceId);
  const rows = (data ?? []) as { priority: string; client_id: string | null; first_response_minutes: number | null; resolution_minutes: number | null }[];
  return (["critical", "high", "medium", "low"] as const).map((priority) => {
    const base = rows.find((r) => r.priority === priority && r.client_id === null);
    const over = clientId ? rows.find((r) => r.priority === priority && r.client_id === clientId) : undefined;
    return {
      priority,
      base: { first: base?.first_response_minutes ?? null, resolution: base?.resolution_minutes ?? null },
      override: over ? { first: over.first_response_minutes, resolution: over.resolution_minutes } : null,
    };
  });
}

/** Ticket timestamps for metrics, filtered by client, technician and status. */
export async function loadMetricTickets(workspaceId: string, f: { client?: string; assignee?: string; status?: string }) {
  const supabase = await createClient();
  let q = supabase
    .from("tickets")
    .select("id,reference,subject,status,priority,category,client_id,assignee_id,created_at,first_response_due_at,resolution_due_at,first_responded_at,resolved_at,closed_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(10000);
  if (f.client === "none") q = q.is("client_id", null);
  else if (f.client && UUID.test(f.client)) q = q.eq("client_id", f.client);
  if (f.assignee === "unassigned") q = q.is("assignee_id", null);
  else if (f.assignee && UUID.test(f.assignee)) q = q.eq("assignee_id", f.assignee);
  if (f.status && ["open", "in_progress", "waiting_customer", "waiting_third_party", "resolved", "closed"].includes(f.status)) q = q.eq("status", f.status);
  const { data, error } = await q;
  return { tickets: (data ?? []) as (Ticket & { reference: string; subject: string })[], error: Boolean(error), capped: (data?.length ?? 0) >= 10000 };
}
