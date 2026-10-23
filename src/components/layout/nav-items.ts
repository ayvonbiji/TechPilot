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
  const myWorkspace: NavItem[] = [
    { href: "/dashboard", label: "My day", icon: LayoutDashboard },
    { href: "/tasks", label: "My tasks", icon: ListChecks },
    { href: "/worklog", label: "Work log", icon: NotebookPen },
    { href: "/reports", label: "Work summaries", icon: FileText },
    { href: "/notes", label: "Notes & commands", icon: SquareTerminal },
    { href: "/learning", label: "Learning tracker", icon: GraduationCap },
    { href: "/resources", label: "Resources", icon: Bookmark },
  ];
  const notifications: NavItem = { href: "/notifications", label: "Notifications", icon: Bell, badge: unread };
  const platform = platformAdmin ? [{ label: "Platform", items: [{ href: "/platform", label: "Platform overview", icon: Server }] }] : [];

  if (type === "personal") {
    return [
      {
        label: "Work",
        items: [
          myWorkspace[0],
          { href: "/tickets", label: "Tickets", icon: Inbox },
          myWorkspace[1],
          myWorkspace[2],
          myWorkspace[3],
        ],
      },
      {
        label: "Knowledge",
        items: [{ href: "/knowledge", label: "Knowledge base", icon: Wrench }, myWorkspace[4], myWorkspace[6]],
      },
      { label: "Growth", items: [myWorkspace[5], notifications] },
      ...platform,
    ];
  }

  const groups: { label: string; items: NavItem[] }[] = [
    {
      label: "Service desk",
      items: [
        { href: "/overview", label: "Overview", icon: Gauge },
        { href: "/tickets", label: "Tickets", icon: Inbox },
        { href: "/clients", label: "Clients", icon: Building2 },
        { href: "/customer-portal", label: "Customer portal", icon: MonitorSmartphone },
        { href: "/knowledge", label: "Knowledge base", icon: Wrench },
        { href: "/service-reports", label: "Reports", icon: BarChart3 },
        notifications,
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
  groups.push({ label: "My workspace", items: myWorkspace }, ...platform);
  return groups;
}

export const SETTINGS_ITEM: NavItem = { href: "/settings", label: "Settings", icon: Settings };
