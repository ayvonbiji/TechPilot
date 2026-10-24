import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell, Search } from "lucide-react";
import { getProfile, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMembership, getMemberships, isStaffRole } from "@/lib/workspace";
import { SidebarContent } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { ThemeSync, ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [profile, memberships, current] = await Promise.all([getProfile(), getMemberships(), getCurrentMembership()]);
  // Customer accounts work in the simplified client portal, never in the staff app.
  if (!isStaffRole(current.role)) redirect("/portal");

  const supabase = await createClient();
  const [unreadRes, platformRes] = await Promise.all([
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
    supabase.from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle(),
  ]);
  const unread = unreadRes.count ?? 0;
  const platformAdmin = Boolean(platformRes.data);

  const workspaces = memberships.map((m) => ({
    id: m.workspace.id,
    name: m.workspace.name,
    type: m.workspace.type,
    role: m.role,
    brand_color: m.workspace.brand_color,
    logo_url: m.workspace.logo_url,
  }));

  return (
    <div className="min-h-dvh lg:pl-64">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-accent px-3 py-2 text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>
      <aside className="no-print fixed inset-y-0 left-0 hidden w-64 lg:block">
        <SidebarContent workspaces={workspaces} currentId={current.workspace.id} unread={unread} platformAdmin={platformAdmin} />
      </aside>
      <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/85 px-4 backdrop-blur sm:px-6 lg:px-8">
        <MobileNav workspaces={workspaces} currentId={current.workspace.id} unread={unread} platformAdmin={platformAdmin} />
        <form action="/search" role="search" className="relative hidden max-w-md flex-1 md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden />
          <label htmlFor="global-search" className="sr-only">Search tickets, clients and knowledge base</label>
          <input
            id="global-search"
            name="q"
            type="search"
            maxLength={100}
            placeholder={current.workspace.type === "personal" ? "Search tickets, knowledge base…" : "Search tickets, clients, knowledge base…"}
            className="h-9 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm placeholder:text-subtle focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
          />
        </form>
        <div className="flex-1" />
        <Link href="/search" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground md:hidden" aria-label="Search">
          <Search className="h-4.5 w-4.5" aria-hidden />
        </Link>
        <Link
          href="/notifications"
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground"
          aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        >
          <Bell className="h-4.5 w-4.5" aria-hidden />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 min-w-4.5 rounded-full bg-danger px-1 text-center text-[10px] font-semibold leading-4.5 text-white" aria-hidden>
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Link>
        <ThemeToggle />
        <UserMenu name={profile.display_name} email={user.email} />
      </header>
      <ThemeSync theme={profile.theme} />
      <main id="main" className="mx-auto w-full max-w-[1240px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {children}
      </main>
    </div>
  );
}
