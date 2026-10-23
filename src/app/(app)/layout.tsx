import { redirect } from "next/navigation";
import { getProfile, requireUser } from "@/lib/auth";
import { getCurrentMembership, getMemberships, isStaffRole } from "@/lib/workspace";
import { SidebarContent } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { ThemeSync, ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [profile, memberships, current] = await Promise.all([getProfile(), getMemberships(), getCurrentMembership()]);
  // Client users work in the simplified client portal, never in the staff app.
  if (!isStaffRole(current.role)) redirect("/portal");
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
        <SidebarContent workspaces={workspaces} currentId={current.workspace.id} />
      </aside>
      <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/85 px-4 backdrop-blur sm:px-6 lg:px-8">
        <MobileNav workspaces={workspaces} currentId={current.workspace.id} />
        <div className="flex-1" />
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
