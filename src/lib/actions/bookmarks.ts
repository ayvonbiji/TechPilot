"use server";

import { revalidatePath } from "next/cache";
import { bookmarkSchema } from "@/lib/validation/schemas";
import { validate } from "@/lib/validation/common";
import { STARTER_RESOURCES } from "@/lib/starter-resources";
import type { ActionResult } from "@/lib/types";
import { authed, dbFail, invalid, isUuid } from "./helpers";

export async function createBookmark(input: unknown): Promise<ActionResult> {
  const v = validate(bookmarkSchema, input);
  if (!v.success) return invalid(v.fieldErrors);
  const a = await authed();
  if ("error" in a) return a.error!;
  const { error } = await a.supabase.from("bookmarks").insert({ ...v.data, user_id: a.user.id });
  if (error) return dbFail(error);
  revalidatePath("/resources");
  return { ok: true, message: "Link saved" };
}

export async function updateBookmark(id: string, input: unknown): Promise<ActionResult> {
  if (!isUuid(id)) return { ok: false, error: "Link not found." };
  const v = validate(bookmarkSchema, input);
  if (!v.success) return invalid(v.fieldErrors);
  const a = await authed();
  if ("error" in a) return a.error!;
  const { data, error } = await a.supabase.from("bookmarks").update(v.data).eq("id", id).select("id");
  if (error) return dbFail(error);
  if (!data?.length) return { ok: false, error: "Link not found." };
  revalidatePath("/resources");
  return { ok: true, message: "Link saved" };
}

export async function deleteBookmark(id: string): Promise<ActionResult> {
  if (!isUuid(id)) return { ok: false, error: "Link not found." };
  const a = await authed();
  if ("error" in a) return a.error!;
  const { error } = await a.supabase.from("bookmarks").delete().eq("id", id);
  if (error) return dbFail(error, "Couldn't delete. Try again.");
  revalidatePath("/resources");
  return { ok: true, message: "Link deleted" };
}

export async function addStarterResources(): Promise<ActionResult> {
  const a = await authed();
  if ("error" in a) return a.error!;
  const { data: existing, error: readError } = await a.supabase.from("bookmarks").select("url");
  if (readError) return dbFail(readError);
  const have = new Set((existing ?? []).map((b: { url: string }) => b.url));
  const rows = STARTER_RESOURCES.filter((r) => !have.has(r.url)).map((r) => ({ ...r, user_id: a.user.id }));
  if (!rows.length) return { ok: true, message: "You already have all the recommended links." };
  const { error } = await a.supabase.from("bookmarks").insert(rows, { defaultToNull: false });
  if (error) return dbFail(error);
  revalidatePath("/resources");
  return { ok: true, message: `Added ${rows.length} recommended links` };
}
