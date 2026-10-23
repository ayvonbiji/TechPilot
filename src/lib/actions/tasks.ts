"use server";

import { revalidatePath } from "next/cache";
import { taskSchema } from "@/lib/validation/schemas";
import { validate } from "@/lib/validation/common";
import type { ActionResult } from "@/lib/types";
import { authed, dbFail, invalid, isUuid } from "./helpers";

function refresh() {
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
}

export async function createTask(input: unknown): Promise<ActionResult> {
  const v = validate(taskSchema, input);
  if (!v.success) return invalid(v.fieldErrors);
  const a = await authed();
  if ("error" in a) return a.error!;
  const { error } = await a.supabase.from("tasks").insert({ ...v.data, user_id: a.user.id });
  if (error) return dbFail(error);
  refresh();
  return { ok: true, message: "Task added" };
}

export async function updateTask(id: string, input: unknown): Promise<ActionResult> {
  if (!isUuid(id)) return { ok: false, error: "Task not found." };
  const v = validate(taskSchema, input);
  if (!v.success) return invalid(v.fieldErrors);
  const a = await authed();
  if ("error" in a) return a.error!;
  const { data, error } = await a.supabase.from("tasks").update(v.data).eq("id", id).select("id");
  if (error) return dbFail(error);
  if (!data?.length) return { ok: false, error: "Task not found." };
  refresh();
  return { ok: true, message: "Task saved" };
}

export async function setTaskStatus(id: string, status: string): Promise<ActionResult> {
  if (!isUuid(id) || !["pending", "in_progress", "completed"].includes(status)) {
    return { ok: false, error: "Invalid request." };
  }
  const a = await authed();
  if ("error" in a) return a.error!;
  const { data, error } = await a.supabase.from("tasks").update({ status }).eq("id", id).select("id");
  if (error) return dbFail(error);
  if (!data?.length) return { ok: false, error: "Task not found." };
  refresh();
  return { ok: true, message: status === "completed" ? "Marked as completed" : "Status updated" };
}

export async function deleteTask(id: string): Promise<ActionResult> {
  if (!isUuid(id)) return { ok: false, error: "Task not found." };
  const a = await authed();
  if ("error" in a) return a.error!;
  const { error } = await a.supabase.from("tasks").delete().eq("id", id);
  if (error) return dbFail(error, "Couldn't delete. Try again.");
  refresh();
  return { ok: true, message: "Task deleted" };
}
