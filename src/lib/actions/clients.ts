"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import type { PostgrestError } from "@supabase/supabase-js";
import { clientSchema, customerInviteSchema, slaSchema } from "@/lib/validation/schemas";
import { validate } from "@/lib/validation/common";
import { getCurrentMembership, isAdminRole, isStaffRole } from "@/lib/workspace";
import type { ActionResult } from "@/lib/types";
import { authed, invalid, isUuid } from "./helpers";

function fail(error: PostgrestError | null, fallback = "Couldn't save. Try again."): ActionResult {
  if (error) console.error("[clients]", error.code, error.message);
  if (error && ["22023", "23505", "54000"].includes(error.code ?? "")) return { ok: false, error: error.message.replace(/\.?$/, ".") };
  if (error?.code === "42501") return { ok: false, error: "Only workspace administrators can do that." };
  return { ok: false, error: fallback };
}

async function ctx(adminOnly = false) {
  const a = await authed();
  if ("error" in a) return { error: a.error as ActionResult };
  const m = await getCurrentMembership();
  if (!isStaffRole(m.role) || (adminOnly && !isAdminRole(m.role))) {
    return { error: { ok: false, error: adminOnly ? "Only workspace administrators can do that." : "Only staff can do that." } as ActionResult };
  }
  if (m.workspace.type === "personal") return { error: { ok: false, error: "Clients live in freelance or organisation workspaces." } as ActionResult };
  return { ...a, m };
}

function refresh(id?: string) {
  revalidatePath("/clients");
  if (id) revalidatePath(`/clients/${id}`);
  revalidatePath("/tickets");
}

export async function createClientOrg(input: unknown): Promise<ActionResult<{ id: string }>> {
  const v = validate(clientSchema, input);
  if (!v.success) return invalid(v.fieldErrors);
  const c = await ctx();
  if ("error" in c) return c.error as ActionResult<{ id: string }>;
  const { data, error } = await c.supabase.from("clients").insert({ ...v.data, workspace_id: c.m.workspace.id }).select("id").single();
  if (error || !data) return fail(error) as ActionResult<{ id: string }>;
  refresh();
  return { ok: true, data: { id: data.id }, message: "Client added" };
}

export async function updateClientOrg(id: string, input: unknown): Promise<ActionResult> {
  if (!isUuid(id)) return { ok: false, error: "Client not found." };
  const v = validate(clientSchema, input);
  if (!v.success) return invalid(v.fieldErrors);
  const c = await ctx();
  if ("error" in c) return c.error as ActionResult;
  const { data, error } = await c.supabase.from("clients").update(v.data).eq("id", id).eq("workspace_id", c.m.workspace.id).select("id");
  if (error) return fail(error);
  if (!data?.length) return { ok: false, error: "Client not found." };
  refresh(id);
  return { ok: true, message: "Client saved" };
}

export async function setClientActive(id: string, active: boolean): Promise<ActionResult> {
  if (!isUuid(id)) return { ok: false, error: "Client not found." };
  const c = await ctx();
  if ("error" in c) return c.error as ActionResult;
  const { data, error } = await c.supabase.from("clients").update({ is_active: active }).eq("id", id).eq("workspace_id", c.m.workspace.id).select("id");
  if (error) return fail(error);
  if (!data?.length) return { ok: false, error: "Client not found." };
  refresh(id);
  return { ok: true, message: active ? "Client reactivated" : "Client deactivated" };
}

export async function addClientTechnician(clientId: string, userId: string): Promise<ActionResult> {
  if (!isUuid(clientId) || !isUuid(userId)) return { ok: false, error: "Invalid request." };
  const c = await ctx(true);
  if ("error" in c) return c.error as ActionResult;
  const { error } = await c.supabase.from("client_technicians").insert({ client_id: clientId, workspace_id: c.m.workspace.id, user_id: userId });
  if (error?.code === "23505") return { ok: false, error: "That technician is already assigned." };
  if (error) return fail(error);
  refresh(clientId);
  return { ok: true, message: "Technician assigned" };
}

export async function removeClientTechnician(clientId: string, userId: string): Promise<ActionResult> {
  if (!isUuid(clientId) || !isUuid(userId)) return { ok: false, error: "Invalid request." };
  const c = await ctx(true);
  if ("error" in c) return c.error as ActionResult;
  const { error } = await c.supabase.from("client_technicians").delete().eq("client_id", clientId).eq("user_id", userId);
  if (error) return fail(error);
  refresh(clientId);
  return { ok: true, message: "Technician removed" };
}

/** Workspace default (clientId null) or a client-specific override for one priority. */
export async function saveSlaTarget(clientId: string | null, input: unknown): Promise<ActionResult> {
  if (clientId !== null && !isUuid(clientId)) return { ok: false, error: "Client not found." };
  const v = validate(slaSchema, input);
  if (!v.success) return invalid(v.fieldErrors);
  const c = await authed();
  if ("error" in c) return c.error as ActionResult;
  const m = await getCurrentMembership();
  if (!isAdminRole(m.role)) return { ok: false, error: "Only workspace administrators can change SLA targets." };
  let q = c.supabase.from("sla_policies").select("id").eq("workspace_id", m.workspace.id).eq("priority", v.data.priority);
  q = clientId ? q.eq("client_id", clientId) : q.is("client_id", null);
  const { data: existing } = await q.maybeSingle();
  const row = { first_response_minutes: v.data.first_response_minutes, resolution_minutes: v.data.resolution_minutes };
  const { error } = existing
    ? await c.supabase.from("sla_policies").update(row).eq("id", existing.id)
    : await c.supabase.from("sla_policies").insert({ ...row, workspace_id: m.workspace.id, client_id: clientId, priority: v.data.priority });
  if (error) return fail(error);
  revalidatePath("/settings/workspace");
  if (clientId) revalidatePath(`/clients/${clientId}`);
  return { ok: true, message: "SLA target saved. It applies to new tickets and priority changes." };
}

export async function clearClientSla(clientId: string, priority: string): Promise<ActionResult> {
  if (!isUuid(clientId) || !["low", "medium", "high", "critical"].includes(priority)) return { ok: false, error: "Invalid request." };
  const c = await ctx(true);
  if ("error" in c) return c.error as ActionResult;
  const { error } = await c.supabase.from("sla_policies").delete().eq("workspace_id", c.m.workspace.id).eq("client_id", clientId).eq("priority", priority);
  if (error) return fail(error);
  revalidatePath(`/clients/${clientId}`);
  return { ok: true, message: "Override removed; the workspace default applies" };
}

async function siteUrl() {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")}://${host}`;
}

/** Invite someone from a client organisation to the customer portal. */
export async function inviteCustomer(clientId: string, input: unknown): Promise<ActionResult<{ link: string }>> {
  if (!isUuid(clientId)) return { ok: false, error: "Client not found." };
  const v = validate(customerInviteSchema, input);
  if (!v.success) return invalid(v.fieldErrors);
  const c = await ctx(true);
  if ("error" in c) return c.error as ActionResult<{ link: string }>;
  const { data, error } = await c.supabase.rpc("create_invitation", {
    ws: c.m.workspace.id,
    p_email: v.data.email,
    p_role: "client",
    p_client: clientId,
  });
  if (error || !data) return fail(error, "Couldn't create the invitation. Try again.") as ActionResult<{ link: string }>;
  refresh(clientId);
  return { ok: true, data: { link: `${await siteUrl()}/invite/${data as string}` }, message: "Invitation created" };
}
