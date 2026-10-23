import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { Profile } from "./types";

export interface CurrentUser {
  id: string;
  email: string;
}

/** Verified current user (JWT checked by Supabase), or null. Deduplicated per request. */
export const getUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return { id: data.claims.sub, email: (data.claims.email as string | undefined) ?? "" };
});

/** Use in pages and layouts: redirects to /login when signed out. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

const DEFAULT_PROFILE: Omit<Profile, "id" | "created_at" | "updated_at"> = {
  display_name: "",
  theme: "system",
  timezone: "UTC",
  date_format: "dd MMM yyyy",
  time_format: "24h",
};

export const getProfile = cache(async (): Promise<Profile> => {
  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  const now = new Date().toISOString();
  return (data as Profile | null) ?? { id: user.id, created_at: now, updated_at: now, ...DEFAULT_PROFILE };
});
