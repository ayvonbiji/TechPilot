// These lists mirror the CHECK constraints in supabase/migrations. Keep them in sync.

export const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
] as const;

export const TASK_STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
] as const;

export const TASK_CATEGORIES = [
  "General",
  "Troubleshooting",
  "Learning",
  "Hardware",
  "Networking",
  "Software",
  "Documentation",
  "Practice lab",
] as const;

// Knowledge-base categories. Mirrors the CHECK in the ticketing migration.
export const KB_CATEGORIES = [
  "Windows troubleshooting",
  "Computer hardware concepts",
  "Networking and TCP/IP",
  "DNS and DHCP",
  "Printers and peripherals",
  "Windows Server",
  "Active Directory and Group Policy",
  "Microsoft 365",
  "Linux",
  "Cloud fundamentals",
  "Cybersecurity",
  "General IT support",
] as const;

/** Earlier categories: still valid for existing articles, not offered for new ones. */
export const LEGACY_KB_CATEGORIES = [
  "Hardware and peripherals",
  "Networking",
  "TCP/IP, DNS and DHCP",
  "Printers and scanners",
  "Software installation",
  "Windows Server and Active Directory",
  "Remote support",
  "Basic cybersecurity",
  "Other technical issues",
] as const;

export const ALL_KB_CATEGORIES = [...KB_CATEGORIES, ...LEGACY_KB_CATEGORIES] as const;

export const KB_VISIBILITY = [
  { value: "private", label: "Private", hint: "Only you" },
  { value: "workspace", label: "Team", hint: "Technicians and admins in this workspace" },
  { value: "public", label: "Public", hint: "Also your customers, in the client portal" },
] as const;

export const KB_STATUSES = [
  { value: "investigating", label: "Investigating" },
  { value: "resolved", label: "Resolved" },
] as const;

export const NOTE_CATEGORIES = [
  "General",
  "Command reference",
  "Windows",
  "Networking",
  "PowerShell",
  "Linux",
  "Microsoft 365",
  "Cloud",
  "Security",
  "Procedures",
] as const;

export const SKILL_CATEGORIES = [
  "Computer hardware",
  "Windows desktop support",
  "Networking fundamentals",
  "Windows Server",
  "Active Directory and Group Policy",
  "Microsoft 365",
  "Linux fundamentals",
  "Cloud fundamentals",
  "Cybersecurity basics",
  "IT documentation and communication",
  "Other",
] as const;

export const SKILL_STATUSES = [
  { value: "not_started", label: "Not started" },
  { value: "learning", label: "Learning" },
  { value: "practising", label: "Practising" },
  { value: "completed", label: "Completed" },
] as const;

export const PROFICIENCY_LEVELS = [
  { value: 0, label: "None" },
  { value: 1, label: "Awareness" },
  { value: 2, label: "Beginner" },
  { value: 3, label: "Working" },
  { value: 4, label: "Proficient" },
  { value: 5, label: "Expert" },
] as const;

export const BOOKMARK_CATEGORIES = [
  "Official documentation",
  "Technical tutorials",
  "Training resources",
  "Useful tools",
  "Certification preparation",
] as const;

export const DATE_FORMATS = ["dd MMM yyyy", "dd/MM/yyyy", "MM/dd/yyyy", "yyyy-MM-dd"] as const;

export const PRIVACY_REMINDER =
  "Do not enter confidential company or customer information, credentials, internal IP addresses, ticket contents or employee details. Describe problems in general terms.";

export function labelFor<T extends { value: string | number; label: string }>(
  list: readonly T[],
  value: string | number,
): string {
  return list.find((i) => i.value === value)?.label ?? String(value);
}
