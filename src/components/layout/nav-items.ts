import {
  Bookmark,
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

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Work",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/tasks", label: "My tasks", icon: ListChecks },
      { href: "/worklog", label: "Work log", icon: NotebookPen },
      { href: "/reports", label: "Reports", icon: FileText },
    ],
  },
  {
    label: "Knowledge",
    items: [
      { href: "/knowledge", label: "Troubleshooting", icon: Wrench },
      { href: "/notes", label: "Notes & commands", icon: SquareTerminal },
      { href: "/resources", label: "Resources", icon: Bookmark },
    ],
  },
  {
    label: "Growth",
    items: [{ href: "/learning", label: "Learning tracker", icon: GraduationCap }],
  },
];

export const SETTINGS_ITEM: NavItem = { href: "/settings", label: "Settings", icon: Settings };
