"use server";

import { revalidatePath } from "next/cache";
import { noteSchema } from "@/lib/validation/schemas";
import { validate } from "@/lib/validation/common";
import { COMMAND_LIBRARY } from "@/lib/command-library";
import type { ActionResult } from "@/lib/types";
import { authed, dbFail, invalid, isUuid } from "./helpers";
import { getCurrentMembership, isStaffRole } from "@/lib/workspace";

function refresh(id?: string) {
  revalidatePath("/notes");
  if (id) revalidatePath(`/notes/${id}`);
  revalidatePath("/dashboard");
}

export async function createNote(input: unknown): Promise<ActionResult<{ id: string }>> {
  const v = validate(noteSchema, input);
  if (!v.success) return invalid(v.fieldErrors);
  const a = await authed();
  if ("error" in a) return a.error!;
  const m = await getCurrentMembership();
  if (!isStaffRole(m.role)) return { ok: false, error: "You can't add notes in this workspace." };
  const { data, error } = await a.supabase
    .from("notes")
    .insert({ ...v.data, user_id: a.user.id, workspace_id: m.workspace.id })
    .select("id")
    .single();
  if (error || !data) return dbFail(error);
  refresh();
  return { ok: true, data: { id: data.id }, message: "Note saved" };
}

export async function updateNote(id: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  if (!isUuid(id)) return { ok: false, error: "Note not found." };
  const v = validate(noteSchema, input);
  if (!v.success) return invalid(v.fieldErrors);
  const a = await authed();
  if ("error" in a) return a.error!;
  const { data, error } = await a.supabase.from("notes").update(v.data).eq("id", id).select("id");
  if (error) return dbFail(error);
  if (!data?.length) return { ok: false, error: "Note not found." };
  refresh(id);
  return { ok: true, data: { id }, message: "Note saved" };
}

export async function toggleFavorite(id: string, value: boolean): Promise<ActionResult> {
  if (!isUuid(id)) return { ok: false, error: "Note not found." };
  const a = await authed();
  if ("error" in a) return a.error!;
  const { error } = await a.supabase.from("notes").update({ is_favorite: value }).eq("id", id);
  if (error) return dbFail(error);
  refresh(id);
  return { ok: true, message: value ? "Added to favourites" : "Removed from favourites" };
}

export async function deleteNote(id: string): Promise<ActionResult> {
  if (!isUuid(id)) return { ok: false, error: "Note not found." };
  const a = await authed();
  if ("error" in a) return a.error!;
  const { error } = await a.supabase.from("notes").delete().eq("id", id);
  if (error) return dbFail(error, "Couldn't delete. Try again.");
  refresh(id);
  return { ok: true, message: "Note deleted" };
}

/** Adds the reference notes for common commands, skipping any already imported. */
export async function importCommandLibrary(): Promise<ActionResult<{ added: number }>> {
  const a = await authed();
  if ("error" in a) return a.error!;
  const m = await getCurrentMembership();
  if (!isStaffRole(m.role)) return { ok: false, error: "You can't add notes in this workspace." };
  const { data: existing, error: readError } = await a.supabase
    .from("notes")
    .select("title")
    .eq("workspace_id", m.workspace.id)
    .eq("category", "Command reference");
  if (readError) return dbFail(readError, "Couldn't import the library. Try again.");
  const have = new Set((existing ?? []).map((n: { title: string }) => n.title));
  const rows = COMMAND_LIBRARY.filter((c) => !have.has(c.title)).map((c) => ({
    user_id: a.user.id,
    workspace_id: m.workspace.id,
    title: c.title,
    content: c.content,
    tags: c.tags,
    category: "Command reference",
  }));
  if (!rows.length) return { ok: true, data: { added: 0 }, message: "The command library is already in your notes." };
  const { error } = await a.supabase.from("notes").insert(rows, { defaultToNull: false });
  if (error) return dbFail(error, "Couldn't import the library. Try again.");
  refresh();
  return { ok: true, data: { added: rows.length }, message: `Added ${rows.length} command reference notes` };
}
