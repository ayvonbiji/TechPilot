"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { profileSchema } from "@/lib/validation/schemas";
import { validate } from "@/lib/validation/common";
import { buildDemoData } from "@/lib/demo-data";
import { todayIn } from "@/lib/dates";
import type { ActionResult } from "@/lib/types";
import { authed, dbFail, invalid } from "./helpers";

const DEMO_TABLES = ["tasks", "troubleshooting_records", "notes", "work_logs", "skills", "bookmarks"] as const;

export async function updateProfile(input: unknown): Promise<ActionResult> {
  const v = validate(profileSchema, input);
  if (!v.success) return invalid(v.fieldErrors);
  const a = await authed();
  if ("error" in a) return a.error!;
  const { data, error } = await a.supabase.from("profiles").update(v.data).eq("id", a.user.id).select("id");
  if (error) return dbFail(error);
  if (!data?.length) return { ok: false, error: "Profile not found. Sign out and back in, then try again." };
  revalidatePath("/", "layout");
  return { ok: true, message: "Settings saved" };
}

export async function setThemePreference(theme: string): Promise<ActionResult> {
  if (!["light", "dark", "system"].includes(theme)) return { ok: false, error: "Invalid theme." };
  const a = await authed();
  if ("error" in a) return a.error!;
  const { error } = await a.supabase.from("profiles").update({ theme }).eq("id", a.user.id);
  if (error) return dbFail(error);
  return { ok: true };
}

export async function loadDemoData(): Promise<ActionResult> {
  const a = await authed();
  if ("error" in a) return a.error!;
  const { data: profile } = await a.supabase.from("profiles").select("timezone").eq("id", a.user.id).maybeSingle();
  const tz = profile?.timezone ?? "UTC";
  const today = todayIn(tz);

  const { count } = await a.supabase.from("tasks").select("id", { count: "exact", head: true }).eq("is_demo", true);
  if ((count ?? 0) > 0) return { ok: false, error: "Demo data is already loaded. Remove it first to reload." };

  const demo = buildDemoData(today, tz);
  const own = <T extends object>(rows: T[]) => rows.map((r) => ({ ...r, user_id: a.user.id, is_demo: true }));

  // Skip demo work-log dates the user has already written real entries for.
  const { data: existingLogs } = await a.supabase.from("work_logs").select("log_date").in("log_date", demo.logs.map((l) => l.log_date));
  const taken = new Set((existingLogs ?? []).map((l: { log_date: string }) => l.log_date));

  const results = await Promise.all([
    a.supabase.from("tasks").insert(own(demo.tasks), { defaultToNull: false }),
    a.supabase.from("troubleshooting_records").insert(own(demo.records), { defaultToNull: false }),
    a.supabase.from("notes").insert(own(demo.notes), { defaultToNull: false }),
    a.supabase.from("skills").insert(own(demo.skills), { defaultToNull: false }),
    demo.logs.some((l) => !taken.has(l.log_date))
      ? a.supabase.from("work_logs").insert(own(demo.logs.filter((l) => !taken.has(l.log_date))), { defaultToNull: false })
      : Promise.resolve({ error: null }),
  ]);
  const failed = results.find((r) => r.error);
  if (failed?.error) {
    await removeDemoRows(a.supabase, a.user.id);
    return dbFail(failed.error, "Couldn't load demo data. Try again.");
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "Demo data loaded. Look for the Demo badge." };
}

async function removeDemoRows(supabase: SupabaseClient, userId: string) {
  return Promise.all(DEMO_TABLES.map((t) => supabase.from(t).delete().eq("is_demo", true).eq("user_id", userId)));
}

export async function removeDemoData(): Promise<ActionResult> {
  const a = await authed();
  if ("error" in a) return a.error!;
  const results = await removeDemoRows(a.supabase, a.user.id);
  const failed = results.find((r) => r.error);
  if (failed?.error) return dbFail(failed.error, "Couldn't remove all demo data. Try again.");
  revalidatePath("/", "layout");
  return { ok: true, message: "Demo data removed" };
}

export async function deleteAccount(confirmation: string): Promise<ActionResult> {
  if (confirmation !== "DELETE") return invalid({ confirm: 'Type DELETE in capitals to confirm.' });
  const a = await authed();
  if ("error" in a) return a.error!;
  const { error } = await a.supabase.rpc("delete_own_account");
  if (error?.code === "22023") return { ok: false, error: error.message };
  if (error) return dbFail(error, "Couldn't delete the account. Try again, or contact support for your Supabase project.");
  await a.supabase.auth.signOut();
  redirect("/login?message=deleted");
}
