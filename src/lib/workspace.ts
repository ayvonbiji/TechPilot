import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import { requireUser } from "./auth";

export type WorkspaceType = "personal" | "freelance" | "organisation";
export type Role = "owner" | "admin" | "agent" | "client";

export interface Workspace {
  id: string;
  type: WorkspaceType;
  name: string;
  ticket_prefix: string;
  brand_color: string | null;
  logo_url: string | null;
  created_at: string;
}

export interface Membership {
  workspace: Workspace;
  role: Role;
  clientId: string | null;
}

export const WS_COOKIE = "tp_ws";

/** All workspaces the signed-in user belongs to (RLS returns only their own memberships' workspaces). */
export const getMemberships = cache(async (): Promise<Membership[]> => {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspace_members")
    .select("role, client_id, workspaces(id, type, name, ticket_prefix, brand_color, logo_url, created_at)")
    .eq("user_id", user.id);
  if (error) {
    // The app is newer than the database: the workspace migration hasn't been run.
    // PGRST205 = table missing, PGRST200 = relationship missing (PostgREST schema cache); 42P01 = undefined table.
    if (["PGRST200", "PGRST205", "42P01"].includes(error.code)) redirect("/setup?reason=database-update");
    console.error("[workspaces]", error.code, error.message);
    throw new Error("Couldn't load your workspaces");
  }
  const order: Record<WorkspaceType, number> = { personal: 0, freelance: 1, organisation: 2 };
  return (data ?? [])
    .filter((m) => m.workspaces)
    .map((m) => ({
      workspace: m.workspaces as unknown as Workspace,
      role: m.role as Role,
      clientId: (m.client_id as string | null) ?? null,
    }))
    .sort((a, b) => order[a.workspace.type] - order[b.workspace.type] || a.workspace.name.localeCompare(b.workspace.name));
});

/**
 * The workspace the user is working in: the one in the cookie if they're still a member,
 * otherwise their personal workspace. Membership is re-checked on every request.
 */
export const getCurrentMembership = cache(async (): Promise<Membership> => {
  const memberships = await getMemberships();
  const wanted = (await cookies()).get(WS_COOKIE)?.value;
  const current =
    memberships.find((m) => m.workspace.id === wanted) ??
    memberships.find((m) => m.workspace.type === "personal") ??
    memberships[0];
  if (!current) redirect("/auth/error");
  return current;
});

export const isStaffRole = (r: Role) => r === "owner" || r === "admin" || r === "agent";
export const isAdminRole = (r: Role) => r === "owner" || r === "admin";

/** For staff-only pages: client users are sent to their portal. */
export async function requireStaff(): Promise<Membership> {
  const m = await getCurrentMembership();
  if (!isStaffRole(m.role)) redirect("/portal");
  return m;
}

export async function requireWorkspaceAdmin(): Promise<Membership> {
  const m = await requireStaff();
  if (!isAdminRole(m.role)) redirect("/dashboard");
  return m;
}

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  admin: "Administrator",
  agent: "Technician",
  client: "Client",
};

export const TYPE_LABELS: Record<WorkspaceType, string> = {
  personal: "Personal",
  freelance: "Freelance",
  organisation: "Organisation",
};
