"use server";

import { revalidatePath } from "next/cache";
import type { PostgrestError } from "@supabase/supabase-js";
import {
  commentSchema,
  portalTicketSchema,
  ticketCreateSchema,
  ticketEditSchema,
  ticketPriority,
  ticketStatusSchema,
} from "@/lib/validation/schemas";
import { validate } from "@/lib/validation/common";
import { getCurrentMembership, isAdminRole, isStaffRole } from "@/lib/workspace";
import { canTransition, type TicketStatus } from "@/lib/tickets";
import type { ActionResult } from "@/lib/types";
import { authed, invalid, isUuid } from "./helpers";

/** Database rules raise clear messages (workflow, permissions, limits); show those. */
function ticketFail(error: PostgrestError | null, fallback = "Couldn't save the ticket. Try again."): ActionResult {
  if (error) console.error("[tickets]", error.code, error.message);
  if (error && ["22023", "54000"].includes(error.code ?? "")) return { ok: false, error: error.message.replace(/\.?$/, ".") };
  if (error?.code === "42501") return { ok: false, error: "You don't have permission to do that." };
  if (error?.code === "23503") return { ok: false, error: "That item belongs to a different workspace or no longer exists." };
  return { ok: false, error: fallback };
}

function refresh(id?: string) {
  revalidatePath("/tickets");
  revalidatePath("/overview");
  revalidatePath("/portal");
  if (id) {
    revalidatePath(`/tickets/${id}`);
    revalidatePath(`/portal/tickets/${id}`);
  }
}

async function staffContext() {
  const a = await authed();
  if ("error" in a) return { error: a.error! };
  const m = await getCurrentMembership();
  if (!isStaffRole(m.role)) return { error: { ok: false, error: "Only staff can do that." } as ActionResult };
  return { ...a, m };
}

export async function createTicket(input: unknown): Promise<ActionResult<{ id: string; reference: string }>> {
  const v = validate(ticketCreateSchema, input);
  if (!v.success) return invalid(v.fieldErrors);
  const c = await staffContext();
  if ("error" in c) return c.error as ActionResult<{ id: string; reference: string }>;
  const { data, error } = await c.supabase
    .from("tickets")
    .insert({ ...v.data, workspace_id: c.m.workspace.id })
    .select("id,reference")
    .single();
  if (error || !data) return ticketFail(error) as ActionResult<{ id: string; reference: string }>;
  refresh();
  return { ok: true, data, message: `Ticket ${data.reference} created` };
}

/** Customer portal: organisation and requester are set by the database from the account. */
export async function createPortalTicket(input: unknown): Promise<ActionResult<{ id: string; reference: string }>> {
  const v = validate(portalTicketSchema, input);
  if (!v.success) return invalid(v.fieldErrors);
  const a = await authed();
  if ("error" in a) return a.error as ActionResult<{ id: string; reference: string }>;
  const m = await getCurrentMembership();
  if (m.role !== "client") return { ok: false, error: "The portal is for customer accounts." };
  const { data, error } = await a.supabase
    .from("tickets")
    .insert({ ...v.data, workspace_id: m.workspace.id })
    .select("id,reference")
    .single();
  if (error || !data) return ticketFail(error, "Couldn't submit your request. Try again.") as ActionResult<{ id: string; reference: string }>;
  refresh();
  return { ok: true, data, message: `Request ${data.reference} submitted` };
}

export async function updateTicketDetails(id: string, input: unknown): Promise<ActionResult> {
  if (!isUuid(id)) return { ok: false, error: "Ticket not found." };
  const v = validate(ticketEditSchema, input);
  if (!v.success) return invalid(v.fieldErrors);
  const c = await staffContext();
  if ("error" in c) return c.error as ActionResult;
  const { data, error } = await c.supabase.from("tickets").update(v.data).eq("id", id).select("id");
  if (error) return ticketFail(error);
  if (!data?.length) return { ok: false, error: "Ticket not found." };
  refresh(id);
  return { ok: true, message: "Ticket updated" };
}

type Field = "priority" | "assignee_id" | "client_id" | "kb_article_id" | "category";

/** Single-field changes from the ticket sidebar and the board. */
export async function setTicketField(id: string, field: Field, value: string | null): Promise<ActionResult> {
  if (!isUuid(id)) return { ok: false, error: "Ticket not found." };
  let clean: string | null = value || null;
  if (field === "priority") {
    const p = ticketPriority.safeParse(value);
    if (!p.success) return { ok: false, error: "Choose a valid priority." };
    clean = p.data;
  } else if (field === "category") {
    clean = (value ?? "").trim().slice(0, 60);
    if (!clean) return { ok: false, error: "Category is required." };
  } else if (clean !== null && !isUuid(clean)) {
    return { ok: false, error: "Choose a valid option." };
  }
  const c = await staffContext();
  if ("error" in c) return c.error as ActionResult;
  const { data, error } = await c.supabase.from("tickets").update({ [field]: clean }).eq("id", id).select("id");
  if (error) return ticketFail(error);
  if (!data?.length) return { ok: false, error: "Ticket not found." };
  refresh(id);
  const messages: Record<Field, string> = {
    priority: "Priority updated",
    assignee_id: clean ? "Technician assigned" : "Ticket unassigned",
    client_id: "Client updated",
    kb_article_id: clean ? "Article linked" : "Article unlinked",
    category: "Category updated",
  };
  return { ok: true, message: messages[field] };
}

export async function changeTicketStatus(id: string, input: unknown): Promise<ActionResult> {
  if (!isUuid(id)) return { ok: false, error: "Ticket not found." };
  const v = validate(ticketStatusSchema, input);
  if (!v.success) return invalid(v.fieldErrors);
  const c = await staffContext();
  if ("error" in c) return c.error as ActionResult;
  const { data: current } = await c.supabase.from("tickets").select("status").eq("id", id).maybeSingle();
  if (!current) return { ok: false, error: "Ticket not found." };
  if (!canTransition(current.status as TicketStatus, v.data.status as TicketStatus, isAdminRole(c.m.role))) {
    return { ok: false, error: "That status change isn't allowed from the ticket's current status." };
  }
  const patch: Record<string, string> = { status: v.data.status };
  if (v.data.resolution_summary) patch.resolution_summary = v.data.resolution_summary;
  const { error } = await c.supabase.from("tickets").update(patch).eq("id", id);
  if (error) return ticketFail(error);
  refresh(id);
  return { ok: true, message: "Status updated" };
}

export async function addTicketComment(id: string, input: unknown): Promise<ActionResult> {
  if (!isUuid(id)) return { ok: false, error: "Ticket not found." };
  const v = validate(commentSchema, input);
  if (!v.success) return invalid(v.fieldErrors);
  const a = await authed();
  if ("error" in a) return a.error as ActionResult;
  const m = await getCurrentMembership();
  const internal = isStaffRole(m.role) ? v.data.is_internal : false;
  const { error } = await a.supabase.from("ticket_comments").insert({ ticket_id: id, body: v.data.body, is_internal: internal });
  if (error) return ticketFail(error, "Couldn't send your message. Try again.");
  refresh(id);
  return { ok: true, message: internal ? "Internal note added" : "Reply sent" };
}
