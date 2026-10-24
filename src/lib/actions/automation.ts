"use server";

import { revalidatePath } from "next/cache";
import type { PostgrestError } from "@supabase/supabase-js";
import { automationRuleSchema } from "@/lib/validation/schemas";
import { validate } from "@/lib/validation/common";
import { getCurrentMembership, isAdminRole } from "@/lib/workspace";
import type { ActionResult } from "@/lib/types";
import { authed, invalid, isUuid } from "./helpers";

function fail(error: PostgrestError | null): ActionResult {
  if (error) console.error("[automation]", error.code, error.message);
  if (error?.code === "22023") return { ok: false, error: error.message.replace(/\.?$/, ".") };
  if (error?.code === "23503") return { ok: false, error: "Choose someone who is a member of this workspace." };
  return { ok: false, error: "Couldn't save the rule. Try again." };
}

async function adminCtx() {
  const a = await authed();
  if ("error" in a) return { error: a.error as ActionResult };
  const m = await getCurrentMembership();
  if (!isAdminRole(m.role)) return { error: { ok: false, error: "Only workspace administrators can manage automation." } as ActionResult };
  return { ...a, m };
}

export async function createAutomationRule(input: unknown): Promise<ActionResult> {
  const v = validate(automationRuleSchema, input);
  if (!v.success) return invalid(v.fieldErrors);
  const c = await adminCtx();
  if ("error" in c) return c.error as ActionResult;
  const { count } = await c.supabase.from("automation_rules").select("id", { count: "exact", head: true }).eq("workspace_id", c.m.workspace.id);
  if ((count ?? 0) >= 50) return { ok: false, error: "A workspace can have up to 50 rules." };
  const { error } = await c.supabase
    .from("automation_rules")
    .insert({ ...v.data, workspace_id: c.m.workspace.id, position: count ?? 0, created_by: c.user.id });
  if (error) return fail(error);
  revalidatePath("/settings/workspace");
  return { ok: true, message: "Rule added" };
}

export async function setAutomationRuleActive(id: string, active: boolean): Promise<ActionResult> {
  if (!isUuid(id)) return { ok: false, error: "Rule not found." };
  const c = await adminCtx();
  if ("error" in c) return c.error as ActionResult;
  const { error } = await c.supabase.from("automation_rules").update({ is_active: active }).eq("id", id).eq("workspace_id", c.m.workspace.id);
  if (error) return fail(error);
  revalidatePath("/settings/workspace");
  return { ok: true, message: active ? "Rule turned on" : "Rule turned off" };
}

export async function deleteAutomationRule(id: string): Promise<ActionResult> {
  if (!isUuid(id)) return { ok: false, error: "Rule not found." };
  const c = await adminCtx();
  if ("error" in c) return c.error as ActionResult;
  const { error } = await c.supabase.from("automation_rules").delete().eq("id", id).eq("workspace_id", c.m.workspace.id);
  if (error) return fail(error);
  revalidatePath("/settings/workspace");
  return { ok: true, message: "Rule deleted" };
}
