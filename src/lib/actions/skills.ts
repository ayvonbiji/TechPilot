"use server";

import { revalidatePath } from "next/cache";
import { skillSchema } from "@/lib/validation/schemas";
import { validate } from "@/lib/validation/common";
import type { ActionResult } from "@/lib/types";
import { authed, dbFail, invalid, isUuid } from "./helpers";

function refresh() {
  revalidatePath("/learning");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
}

export async function createSkill(input: unknown): Promise<ActionResult> {
  const v = validate(skillSchema, input);
  if (!v.success) return invalid(v.fieldErrors);
  const a = await authed();
  if ("error" in a) return a.error!;
  const { error } = await a.supabase.from("skills").insert({ ...v.data, user_id: a.user.id });
  if (error) return dbFail(error);
  refresh();
  return { ok: true, message: v.data.kind === "certification" ? "Certification added" : "Skill added" };
}

export async function updateSkill(id: string, input: unknown): Promise<ActionResult> {
  if (!isUuid(id)) return { ok: false, error: "Not found." };
  const v = validate(skillSchema, input);
  if (!v.success) return invalid(v.fieldErrors);
  const a = await authed();
  if ("error" in a) return a.error!;
  const { data, error } = await a.supabase.from("skills").update(v.data).eq("id", id).select("id");
  if (error) return dbFail(error);
  if (!data?.length) return { ok: false, error: "Not found." };
  refresh();
  return { ok: true, message: "Saved" };
}

export async function deleteSkill(id: string): Promise<ActionResult> {
  if (!isUuid(id)) return { ok: false, error: "Not found." };
  const a = await authed();
  if ("error" in a) return a.error!;
  const { error } = await a.supabase.from("skills").delete().eq("id", id);
  if (error) return dbFail(error, "Couldn't delete. Try again.");
  refresh();
  return { ok: true, message: "Deleted" };
}
