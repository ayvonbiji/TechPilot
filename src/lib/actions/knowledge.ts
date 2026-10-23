"use server";

import { revalidatePath } from "next/cache";
import { troubleshootingSchema } from "@/lib/validation/schemas";
import { validate } from "@/lib/validation/common";
import type { ActionResult } from "@/lib/types";
import { authed, dbFail, invalid, isUuid } from "./helpers";
import { getCurrentMembership, isStaffRole } from "@/lib/workspace";

function refresh(id?: string) {
  revalidatePath("/knowledge");
  if (id) revalidatePath(`/knowledge/${id}`);
  revalidatePath("/dashboard");
  revalidatePath("/reports");
}

export async function createRecord(input: unknown): Promise<ActionResult<{ id: string }>> {
  const v = validate(troubleshootingSchema, input);
  if (!v.success) return invalid(v.fieldErrors);
  const a = await authed();
  if ("error" in a) return a.error!;
  const m = await getCurrentMembership();
  if (!isStaffRole(m.role)) return { ok: false, error: "You can't add records in this workspace." };
  const { data, error } = await a.supabase
    .from("troubleshooting_records")
    .insert({ ...v.data, user_id: a.user.id, workspace_id: m.workspace.id })
    .select("id")
    .single();
  if (error || !data) return dbFail(error);
  refresh();
  return { ok: true, data: { id: data.id }, message: "Record saved" };
}

export async function updateRecord(id: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  if (!isUuid(id)) return { ok: false, error: "Record not found." };
  const v = validate(troubleshootingSchema, input);
  if (!v.success) return invalid(v.fieldErrors);
  const a = await authed();
  if ("error" in a) return a.error!;
  const { data, error } = await a.supabase.from("troubleshooting_records").update(v.data).eq("id", id).select("id");
  if (error) return dbFail(error);
  if (!data?.length) return { ok: false, error: "Record not found." };
  refresh(id);
  return { ok: true, data: { id }, message: "Record saved" };
}

export async function deleteRecord(id: string): Promise<ActionResult> {
  if (!isUuid(id)) return { ok: false, error: "Record not found." };
  const a = await authed();
  if ("error" in a) return a.error!;
  const { error } = await a.supabase.from("troubleshooting_records").delete().eq("id", id);
  if (error) return dbFail(error, "Couldn't delete. Try again.");
  refresh(id);
  return { ok: true, message: "Record deleted" };
}
