"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { emailSchema, newPasswordSchema, signInSchema, signUpSchema } from "@/lib/validation/schemas";
import { validate } from "@/lib/validation/common";
import type { ActionResult } from "@/lib/types";
import { invalid } from "./helpers";

async function siteUrl() {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function safeNext(next: unknown): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export async function signIn(input: unknown, next?: string): Promise<ActionResult> {
  const v = validate(signInSchema, input);
  if (!v.success) return invalid(v.fieldErrors);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(v.data);
  if (error) {
    if (error.code === "email_not_confirmed") {
      return { ok: false, error: "Confirm your email first — check your inbox for the link." };
    }
    return { ok: false, error: "Email or password is incorrect." };
  }
  redirect(safeNext(next));
}

export async function signUp(input: unknown, next?: string): Promise<ActionResult<{ needsConfirmation: boolean }>> {
  const v = validate(signUpSchema, input);
  if (!v.success) return invalid(v.fieldErrors);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: v.data.email,
    password: v.data.password,
    options: {
      data: { display_name: v.data.displayName },
      emailRedirectTo: `${await siteUrl()}/auth/confirm?next=${encodeURIComponent(safeNext(next))}`,
    },
  });
  if (error) {
    if (error.code === "weak_password") return invalid({ password: error.message });
    if (error.code === "over_email_send_rate_limit") {
      return { ok: false, error: "Too many emails sent. Wait a few minutes and try again." };
    }
    return { ok: false, error: "Couldn't create the account. Try again." };
  }
  if (data.session) redirect(safeNext(next));
  return { ok: true, data: { needsConfirmation: true } };
}

export async function requestPasswordReset(input: unknown): Promise<ActionResult> {
  const v = validate(emailSchema, input);
  if (!v.success) return invalid(v.fieldErrors);
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(v.data.email, {
    redirectTo: `${await siteUrl()}/auth/confirm?next=/auth/reset-password`,
  });
  // Same response whether or not the account exists, so emails can't be enumerated.
  return { ok: true, message: "If an account exists for that email, a reset link is on its way." };
}

export async function updatePassword(input: unknown): Promise<ActionResult> {
  const v = validate(newPasswordSchema, input);
  if (!v.success) return invalid(v.fieldErrors);
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return { ok: false, error: "The reset link has expired. Request a new one." };
  const { error } = await supabase.auth.updateUser({ password: v.data.password });
  if (error) {
    if (error.code === "same_password") return invalid({ password: "Choose a password you haven't used before." });
    return { ok: false, error: "Couldn't update the password. Try again." };
  }
  return { ok: true, message: "Password updated." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
