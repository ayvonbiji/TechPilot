import {
  BarChart3,
  Bell,
  Bookmark,
  Building2,
  FileText,
  Gauge,
  GraduationCap,
  Inbox,
  LayoutDashboard,
  ListChecks,
  MonitorSmartphone,
  NotebookPen,
  Server,
  Settings,
  SlidersHorizontal,
  SquareTerminal,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Unread count shown as a badge. */
  badge?: number;
}

export type WsType = "personal" | "freelance" | "organisation";
export type WsRole = "owner" | "admin" | "agent" | "client";

export interface NavContext {
  type: WsType;
  role: WsRole;
  unread?: number;
  platformAdmin?: boolean;
}

/**
 * Navigation for the current workspace and role. Only items the role may use
 * are shown; every page also checks the role on the server.
 */
export function navFor({ type, role, unread = 0, platformAdmin }: NavContext): { label: string; items: NavItem[] }[] {
  const notifications: NavItem = { href: "/notifications", label: "Notifications", icon: Bell, badge: unread };
  const knowledge: NavItem = { href: "/knowledge", label: "Knowledge base", icon: Wrench };
  const tools: NavItem[] = [
    { href: "/tasks", label: "My tasks", icon: ListChecks },
    { href: "/worklog", label: "Work log", icon: NotebookPen },
    { href: "/reports", label: "Work summaries", icon: FileText },
    { href: "/notes", label: "Notes & commands", icon: SquareTerminal },
    { href: "/resources", label: "Resources", icon: Bookmark },
  ];
  const growth = { label: "Growth", items: [{ href: "/learning", label: "Learning tracker", icon: GraduationCap }] };
  const platform = platformAdmin ? [{ label: "Platform", items: [{ href: "/platform", label: "Platform overview", icon: Server }] }] : [];

  if (type === "personal") {
    return [
      {
        label: "Work",
        items: [
          { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
          { href: "/tickets", label: "Tickets", icon: Inbox },
          knowledge,
          notifications,
        ],
      },
      { label: "Tools", items: tools },
      growth,
      ...platform,
    ];
  }

  const groups: { label: string; items: NavItem[] }[] = [
    {
      label: "Work",
      items: [
        { href: "/overview", label: "Dashboard", icon: Gauge },
        { href: "/tickets", label: "Tickets", icon: Inbox },
        { href: "/clients", label: "Clients", icon: Building2 },
        knowledge,
        { href: "/service-reports", label: "Reports", icon: BarChart3 },
        notifications,
        { href: "/customer-portal", label: "Customer portal", icon: MonitorSmartphone },
      ],
    },
  ];
  if (role === "owner" || role === "admin") {
    groups.push({
      label: "Administration",
      items: [
        { href: "/team", label: "Team", icon: Users },
        { href: "/settings/workspace", label: "Workspace settings", icon: SlidersHorizontal },
      ],
    });
  }
  groups.push(
    { label: "Tools", items: [{ href: "/dashboard", label: "My day", icon: LayoutDashboard }, ...tools] },
    growth,
    ...platform,
  );
  return groups;
}

export const SETTINGS_ITEM: NavItem = { href: "/settings", label: "Settings", icon: Settings };
