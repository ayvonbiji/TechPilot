import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { AcceptInviteButton } from "./accept-button";

export const metadata: Metadata = { title: "Invitation" };

const ROLE: Record<string, string> = { admin: "an administrator", agent: "a technician", client: "a client user" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const valid = /^[0-9a-f]{48}$/.test(token);
  const supabase = await createClient();
  const [user, peek] = await Promise.all([
    getUser(),
    valid ? supabase.rpc("peek_invitation", { p_token: token }).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const inv = peek.data as { workspace_name: string; workspace_type: string; role: string; email: string; status: string } | null;
  const next = encodeURIComponent(`/invite/${token}`);

  let body: React.ReactNode;
  if (!inv || inv.status !== "pending") {
    const reason =
      inv?.status === "accepted" ? "This invitation has already been used." :
      inv?.status === "revoked" ? "This invitation was cancelled by the workspace administrator." :
      inv?.status === "expired" ? "This invitation has expired." :
      "This invitation link isn't valid.";
    body = (
      <>
        <span className="led text-danger" aria-hidden />
        <h1 className="mt-3 text-xl font-semibold">Invitation unavailable</h1>
        <p className="mt-2 text-sm text-muted">{reason} Ask the person who invited you for a new link.</p>
        <Button asChild variant="secondary" className="mt-6"><Link href={user ? "/dashboard" : "/login"}>{user ? "Go to dashboard" : "Sign in"}</Link></Button>
      </>
    );
  } else {
    const mismatch = user && user.email.toLowerCase() !== inv.email;
    body = (
      <>
        <span className="led text-ok" aria-hidden />
        <h1 className="mt-3 text-xl font-semibold">Join {inv.workspace_name}</h1>
        <p className="mt-2 text-sm text-muted">
          You&apos;ve been invited to join as {ROLE[inv.role] ?? inv.role}. This invitation is for{" "}
          <span className="font-medium text-foreground">{inv.email}</span>.
        </p>
        {!user ? (
          <div className="mt-6 flex flex-wrap gap-2">
            <Button asChild><Link href={`/signup?email=${encodeURIComponent(inv.email)}&next=${next}`}>Create account</Link></Button>
            <Button asChild variant="secondary"><Link href={`/login?next=${next}`}>I already have an account</Link></Button>
          </div>
        ) : mismatch ? (
          <div className="mt-6 space-y-3">
            <p className="rounded-lg border border-warn/30 bg-warn-soft px-3 py-2.5 text-[13px]">
              You&apos;re signed in as {user.email}. Sign out and sign in with {inv.email} to accept.
            </p>
            <Button asChild variant="secondary"><Link href="/settings">Go to settings to sign out</Link></Button>
          </div>
        ) : (
          <div className="mt-6"><AcceptInviteButton token={token} /></div>
        )}
      </>
    );
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-12">
      <div className="w-full max-w-md">{body}</div>
    </main>
  );
}
