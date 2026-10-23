"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navFor, SETTINGS_ITEM, type NavItem } from "./nav-items";
import { WorkspaceSwitcher, type SwitcherWorkspace } from "./workspace-switcher";
import { cn } from "@/lib/utils";

function Brand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5 px-2 py-1 text-white">
      <span className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-active">
        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <rect x="3" y="4" width="18" height="12" rx="2" />
          <path d="M8 20h8M12 16v4" strokeLinecap="round" />
        </svg>
        <span className="led absolute -right-0.5 -top-0.5 text-ok" aria-hidden />
      </span>
      <span className="leading-tight">
        <span className="block text-[14px] font-semibold">IT Engineer</span>
        <span className="block text-[12px] text-sidebar-muted">Companion</span>
      </span>
    </Link>
  );
}

function NavLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
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
      {item.label}
    </Link>
  );
}

export interface SidebarProps {
  workspaces: SwitcherWorkspace[];
  currentId: string;
  onNavigate?: () => void;
  footer?: React.ReactNode;
}

export function SidebarContent({ workspaces, currentId, onNavigate, footer }: SidebarProps) {
  const current = workspaces.find((w) => w.id === currentId) ?? workspaces[0];
  const groups = navFor(current.type, current.role);
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
