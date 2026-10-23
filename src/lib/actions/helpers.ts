import "server-only";
import type { PostgrestError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import type { ActionResult } from "@/lib/types";

/** Supabase client + verified user for a Server Action, or an error result. */
export async function authed() {
  const user = await getUser();
  if (!user) return { error: { ok: false, error: "Your session has ended. Sign in again." } as ActionResult };
  const supabase = await createClient();
  return { supabase, user };
}

/** Map a database error to a safe, helpful message (details go to the server log only). */
export function dbFail(error: PostgrestError | null, fallback = "Couldn't save. Try again."): ActionResult {
  if (error) console.error("[db]", error.code, error.message);
  if (error?.code === "23505") return { ok: false, error: "An entry like this already exists." };
  if (error?.code === "23514") return { ok: false, error: "Some values aren't allowed. Check the form and try again." };
  if (error?.code === "42501") return { ok: false, error: "You don't have access to that item." };
  return { ok: false, error: fallback };
}

export function invalid(fieldErrors: Record<string, string>): ActionResult {
  return { ok: false, error: "Check the highlighted fields.", fieldErrors };
}

export function isUuid(id: unknown): id is string {
  return typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}
