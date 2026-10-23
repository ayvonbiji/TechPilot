import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell } from "lucide-react";
import { getProfile, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMembership, getMemberships, isStaffRole } from "@/lib/workspace";
import { WorkspaceMark } from "@/components/layout/workspace-switcher";
import { ThemeSync, ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { PortalNav } from "./portal-nav";

/** Customer portal shell: separate from the staff app, branded per workspace. */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [profile, memberships, current] = await Promise.all([getProfile(), getMemberships(), getCurrentMembership()]);
  if (isStaffRole(current.role)) redirect("/customer-portal");
  const supabase = await createClient();
  const [{ data: client }, unreadRes] = await Promise.all([
    supabase.from("clients").select("name").eq("id", current.clientId ?? "").maybeSingle(),
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
  ]);
  const ws = current.workspace;
  const unread = unreadRes.count ?? 0;
  const brand = ws.brand_color && /^#[0-9a-f]{6}$/i.test(ws.brand_color) ? ws.brand_color : null;

  return (
    <div className="min-h-dvh" style={brand ? ({ "--accent": brand, "--accent-hover": brand, "--ring": brand } as React.CSSProperties) : undefined}>
      <a href="#main" className="sr-only z-50 rounded-md bg-accent px-3 py-2 text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Skip to content
      </a>
      <header className="no-print border-b border-border bg-surface">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4 sm:px-6">
          <Link href="/portal" className="flex min-w-0 items-center gap-2.5">
            <WorkspaceMark ws={ws} />
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[15px] font-semibold">{ws.name}</span>
              <span className="block truncate text-[12px] text-muted">Support portal{client?.name ? ` for ${client.name}` : ""}</span>
            </span>
          </Link>
          <div className="flex-1" />
          <Link
            href="/portal/notifications"
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground"
            aria-label={unread ? `Updates, ${unread} unread` : "Updates"}
          >
            <Bell className="h-4.5 w-4.5" aria-hidden />
            {unread > 0 && <span className="led absolute right-2 top-2 text-accent" aria-hidden />}
          </Link>
          <ThemeToggle />
          <UserMenu name={profile.display_name} email={user.email} settingsHref="/portal/account" />
        </div>
        <PortalNav otherWorkspaces={memberships.length > 1} />
      </header>
      <ThemeSync theme={profile.theme} />
      <main id="main" className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:py-8">{children}</main>
    </div>
  );
}
