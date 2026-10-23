"use server";

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PostgrestError } from "@supabase/supabase-js";
import { inviteSchema, workspaceCreateSchema, workspaceUpdateSchema } from "@/lib/validation/schemas";
import { validate } from "@/lib/validation/common";
import { getCurrentMembership, isAdminRole, WS_COOKIE } from "@/lib/workspace";
import type { ActionResult } from "@/lib/types";
import { authed, invalid, isUuid } from "./helpers";

/** Database functions raise friendly messages for permission and rule errors; pass those through. */
function rpcFail(error: PostgrestError | null, fallback = "Couldn't complete that. Try again."): ActionResult {
  if (error) console.error("[rpc]", error.code, error.message);
  if (error && ["42501", "22023", "23505", "54000", "28000"].includes(error.code ?? "")) {
    return { ok: false, error: error.message.replace(/\.?$/, ".") };
  }
  return { ok: false, error: fallback };
}

async function setWorkspaceCookie(id: string) {
  (await cookies()).set(WS_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

async function siteUrl() {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")}://${host}`;
}

export async function switchWorkspace(id: string): Promise<ActionResult> {
  if (!isUuid(id)) return { ok: false, error: "Workspace not found." };
  const a = await authed();
  if ("error" in a) return a.error!;
  // RLS returns the workspace only if the user is a member.
  const { data } = await a.supabase.from("workspaces").select("id").eq("id", id).maybeSingle();
  if (!data) return { ok: false, error: "You're not a member of that workspace." };
  await setWorkspaceCookie(id);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function createWorkspace(input: unknown): Promise<ActionResult<{ id: string }>> {
  const v = validate(workspaceCreateSchema, input);
  if (!v.success) return invalid(v.fieldErrors);
  const a = await authed();
  if ("error" in a) return a.error!;
  const { data, error } = await a.supabase.rpc("create_workspace", {
    p_name: v.data.name,
    p_type: v.data.type,
    p_prefix: v.data.ticket_prefix,
  });
  if (error || !data) return rpcFail(error, "Couldn't create the workspace. Try again.");
  await setWorkspaceCookie(data as string);
  revalidatePath("/", "layout");
  return { ok: true, data: { id: data as string }, message: "Workspace created" };
}

export async function updateWorkspace(input: unknown): Promise<ActionResult> {
  const v = validate(workspaceUpdateSchema, input);
  if (!v.success) return invalid(v.fieldErrors);
  const a = await authed();
  if ("error" in a) return a.error!;
  const m = await getCurrentMembership();
  if (!isAdminRole(m.role)) return { ok: false, error: "Only workspace administrators can change these settings." };
  const { data, error } = await a.supabase.from("workspaces").update(v.data).eq("id", m.workspace.id).select("id");
  if (error) return rpcFail(error, "Couldn't save the settings. Try again.");
  if (!data?.length) return { ok: false, error: "Only workspace administrators can change these settings." };
  revalidatePath("/", "layout");
  return { ok: true, message: "Workspace settings saved" };
}

export async function inviteMember(input: unknown): Promise<ActionResult<{ link: string }>> {
  const v = validate(inviteSchema, input);
  if (!v.success) return invalid(v.fieldErrors);
  const a = await authed();
  if ("error" in a) return a.error!;
  const m = await getCurrentMembership();
  const { data, error } = await a.supabase.rpc("create_invitation", {
    ws: m.workspace.id,
    p_email: v.data.email,
    p_role: v.data.role,
  });
  if (error || !data) return rpcFail(error, "Couldn't create the invitation. Try again.");
  revalidatePath("/settings/workspace");
  return { ok: true, data: { link: `${await siteUrl()}/invite/${data as string}` }, message: "Invitation created" };
}

export async function revokeInvitation(id: string): Promise<ActionResult> {
  if (!isUuid(id)) return { ok: false, error: "Invitation not found." };
  const a = await authed();
  if ("error" in a) return a.error!;
  const { error } = await a.supabase.rpc("revoke_invitation", { inv: id });
  if (error) return rpcFail(error);
  revalidatePath("/settings/workspace");
  return { ok: true, message: "Invitation revoked" };
}

export async function setMemberRole(userId: string, role: string): Promise<ActionResult> {
  if (!isUuid(userId) || !["owner", "admin", "agent"].includes(role)) return { ok: false, error: "Invalid request." };
  const a = await authed();
  if ("error" in a) return a.error!;
  const m = await getCurrentMembership();
  const { error } = await a.supabase.rpc("set_member_role", { ws: m.workspace.id, p_user: userId, p_role: role });
  if (error) return rpcFail(error);
  revalidatePath("/settings/workspace");
  return { ok: true, message: "Role updated" };
}

export async function removeMember(userId: string): Promise<ActionResult> {
  if (!isUuid(userId)) return { ok: false, error: "Invalid request." };
  const a = await authed();
  if ("error" in a) return a.error!;
  const m = await getCurrentMembership();
  const { error } = await a.supabase.rpc("remove_member", { ws: m.workspace.id, p_user: userId });
  if (error) return rpcFail(error);
  revalidatePath("/settings/workspace");
  return { ok: true, message: "Member removed" };
}

export async function leaveWorkspace(): Promise<ActionResult> {
  const a = await authed();
  if ("error" in a) return a.error!;
  const m = await getCurrentMembership();
  const { error } = await a.supabase.rpc("remove_member", { ws: m.workspace.id, p_user: a.user.id });
  if (error) return rpcFail(error);
  (await cookies()).delete(WS_COOKIE);
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function deleteWorkspace(confirmName: string): Promise<ActionResult> {
  const a = await authed();
  if ("error" in a) return a.error!;
  const m = await getCurrentMembership();
  if (confirmName.trim() !== m.workspace.name) return invalid({ confirm: "Type the workspace name exactly to confirm." });
  const { error } = await a.supabase.rpc("delete_workspace", { ws: m.workspace.id });
  if (error) return rpcFail(error);
  (await cookies()).delete(WS_COOKIE);
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function acceptInvitation(token: string): Promise<ActionResult> {
  if (!/^[0-9a-f]{48}$/.test(token)) return { ok: false, error: "This invitation link is not valid." };
  const a = await authed();
  if ("error" in a) return a.error!;
  const { data, error } = await a.supabase.rpc("accept_invitation", { p_token: token });
  if (error || !data) return rpcFail(error, "Couldn't accept the invitation. Try again.");
  await setWorkspaceCookie(data as string);
  revalidatePath("/", "layout");
  redirect("/dashboard");
}
