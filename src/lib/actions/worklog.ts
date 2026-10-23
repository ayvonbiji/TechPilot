"use server";

import { revalidatePath } from "next/cache";
import { workLogSchema } from "@/lib/validation/schemas";
import { validate } from "@/lib/validation/common";
import type { ActionResult } from "@/lib/types";
import { authed, dbFail, invalid, isUuid } from "./helpers";

function refresh() {
  revalidatePath("/worklog");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
}

export async function createWorkLog(input: unknown): Promise<ActionResult<{ id: string }>> {
  const v = validate(workLogSchema, input);
  if (!v.success) return invalid(v.fieldErrors);
  const a = await authed();
  if ("error" in a) return a.error!;
  const { data, error } = await a.supabase.from("work_logs").insert({ ...v.data, user_id: a.user.id }).select("id").single();
  if (error?.code === "23505") {
    return invalid({ log_date: "You already have an entry for this date. Open it from the history to edit it." });
  }
  if (error || !data) return dbFail(error);
  refresh();
  return { ok: true, data: { id: data.id }, message: "Work log saved" };
}

export async function updateWorkLog(id: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  if (!isUuid(id)) return { ok: false, error: "Entry not found." };
  const v = validate(workLogSchema, input);
  if (!v.success) return invalid(v.fieldErrors);
  const a = await authed();
  if ("error" in a) return a.error!;
  const { data, error } = await a.supabase.from("work_logs").update(v.data).eq("id", id).select("id");
  if (error?.code === "23505") return invalid({ log_date: "Another entry already uses this date." });
  if (error) return dbFail(error);
  if (!data?.length) return { ok: false, error: "Entry not found." };
  refresh();
  return { ok: true, data: { id }, message: "Work log saved" };
}

export async function deleteWorkLog(id: string): Promise<ActionResult> {
  if (!isUuid(id)) return { ok: false, error: "Entry not found." };
  const a = await authed();
  if ("error" in a) return a.error!;
  const { error } = await a.supabase.from("work_logs").delete().eq("id", id);
  if (error) return dbFail(error, "Couldn't delete. Try again.");
  refresh();
  return { ok: true, message: "Entry deleted" };
}
