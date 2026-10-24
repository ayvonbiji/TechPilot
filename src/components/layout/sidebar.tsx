"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navFor, SETTINGS_ITEM, type NavItem } from "./nav-items";
import { WorkspaceSwitcher, type SwitcherWorkspace } from "./workspace-switcher";
import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand";
import { BrandLockup } from "./brand-mark";

function Brand() {
  return (
    <Link href="/" className="block px-2 py-1" aria-label={`${BRAND.fullName}, home`}>
      <BrandLockup onDark />
    </Link>
  );
}

function NavLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const pathname = usePathname();
  // "/settings" shouldn't light up for "/settings/workspace", which has its own item.
  const active =
    pathname === item.href || (pathname.startsWith(`${item.href}/`) && !(item.href === "/settings" && pathname.startsWith("/settings/workspace")));
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] transition-colors",
        active
          ? "bg-sidebar-active text-white"
          : "text-sidebar-foreground hover:bg-sidebar-2 hover:text-white",
      )}
    >
      {active && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-accent" aria-hidden />}
      <Icon className={cn("h-4 w-4", active ? "text-white" : "text-sidebar-muted group-hover:text-white")} aria-hidden />
      <span className="flex-1">{item.label}</span>
      {item.badge ? (
        <span className="min-w-5 rounded-full bg-accent px-1.5 text-center text-[11px] font-semibold leading-5 text-white" aria-label={`${item.badge} unread`}>
          {item.badge > 99 ? "99+" : item.badge}
        </span>
      ) : null}
    </Link>
  );
}

export interface SidebarProps {
  workspaces: SwitcherWorkspace[];
  currentId: string;
  unread?: number;
  platformAdmin?: boolean;
  onNavigate?: () => void;
  footer?: React.ReactNode;
}

export function SidebarContent({ workspaces, currentId, unread, platformAdmin, onNavigate, footer }: SidebarProps) {
  const current = workspaces.find((w) => w.id === currentId) ?? workspaces[0];
  const groups = navFor({ type: current.type, role: current.role, unread, platformAdmin });
  return (
    <div className="flex h-full flex-col bg-sidebar px-3 py-4">
      <Brand />
      <div className="mt-5">
        <WorkspaceSwitcher workspaces={workspaces} currentId={current.id} />
      </div>
      <nav className="mt-5 flex-1 space-y-5 overflow-y-auto" aria-label="Main">
        {groups.map((g) => (
          <div key={g.label}>
            <p className="px-3 pb-1.5 text-[12px] font-medium text-sidebar-muted">{g.label}</p>
            <div className="space-y-0.5">
              {g.items.map((item) => (
                <NavLink key={item.href} item={item} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="mt-4 space-y-2 border-t border-white/10 pt-3">
        <NavLink item={SETTINGS_ITEM} onNavigate={onNavigate} />
        {footer}
      </div>
    </div>
  );
}
