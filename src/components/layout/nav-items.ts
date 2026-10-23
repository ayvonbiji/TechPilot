import {
  Bookmark,
  Building2,
  FileText,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  NotebookPen,
  Settings,
  SquareTerminal,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export type WsType = "personal" | "freelance" | "organisation";
export type WsRole = "owner" | "admin" | "agent" | "client";

/** Navigation for the current workspace. Personal tools stay available everywhere. */
export function navFor(type: WsType, role: WsRole): { label: string; items: NavItem[] }[] {
  const myWork: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/tasks", label: "My tasks", icon: ListChecks },
    { href: "/worklog", label: "Work log", icon: NotebookPen },
    { href: "/reports", label: "Reports", icon: FileText },
  ];
  const knowledge: NavItem[] = [
    { href: "/knowledge", label: "Troubleshooting", icon: Wrench },
    { href: "/notes", label: "Notes & commands", icon: SquareTerminal },
  ];
  if (type === "personal") {
    return [
      { label: "Work", items: myWork },
      { label: "Knowledge", items: [...knowledge, { href: "/resources", label: "Resources", icon: Bookmark }] },
      { label: "Growth", items: [{ href: "/learning", label: "Learning tracker", icon: GraduationCap }] },
    ];
  }
  const groups = [
    { label: "Team knowledge", items: knowledge },
    {
      label: "My work",
      items: [
        ...myWork,
        { href: "/resources", label: "Resources", icon: Bookmark },
        { href: "/learning", label: "Learning tracker", icon: GraduationCap },
      ],
    },
  ];
  if (role === "owner" || role === "admin") {
    groups.push({ label: "Workspace", items: [{ href: "/settings/workspace", label: "Members & settings", icon: Building2 }] });
  }
  return groups;
}

export const SETTINGS_ITEM: NavItem = { href: "/settings", label: "Settings", icon: Settings };
