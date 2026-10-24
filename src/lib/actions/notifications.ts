"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/types";
import { authed, isUuid } from "./helpers";

function refresh() {
  revalidatePath("/notifications");
  revalidatePath("/portal/notifications");
  revalidatePath("/", "layout");
}

/** RLS limits every query here to the signed-in user's own notifications. */
export async function markNotificationRead(id: string): Promise<ActionResult> {
  if (!isUuid(id)) return { ok: false, error: "Not found." };
  const a = await authed();
  if ("error" in a) return a.error as ActionResult;
  const { error } = await a.supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).is("read_at", null);
  if (error) return { ok: false, error: "Couldn't update. Try again." };
  refresh();
  return { ok: true };
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  const a = await authed();
  if ("error" in a) return a.error as ActionResult;
  const { error } = await a.supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null).eq("user_id", a.user.id);
  if (error) return { ok: false, error: "Couldn't update. Try again." };
  refresh();
  return { ok: true, message: "All marked as read" };
}

export async function clearReadNotifications(): Promise<ActionResult> {
  const a = await authed();
  if ("error" in a) return a.error as ActionResult;
  const { error } = await a.supabase.from("notifications").delete().not("read_at", "is", null).eq("user_id", a.user.id);
  if (error) return { ok: false, error: "Couldn't clear. Try again." };
  refresh();
  return { ok: true, message: "Read notifications cleared" };
}
