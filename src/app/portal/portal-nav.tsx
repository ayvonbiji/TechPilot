"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/portal", label: "My requests" },
  { href: "/portal/new", label: "New request" },
  { href: "/portal/knowledge", label: "Help articles" },
  { href: "/portal/notifications", label: "Updates" },
];

export function PortalNav({ otherWorkspaces }: { otherWorkspaces: boolean }) {
  const pathname = usePathname();
  return (
    <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 sm:px-6" aria-label="Portal">
      {ITEMS.map((i) => {
        const active = i.href === "/portal" ? pathname === "/portal" || pathname.startsWith("/portal/tickets") : pathname.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active ? "page" : undefined}
            className={cn("-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-[13px] font-medium", active ? "border-accent text-foreground" : "border-transparent text-muted hover:text-foreground")}
          >
            {i.label}
          </Link>
        );
      })}
      {otherWorkspaces && (
        <Link href="/switch" className="-mb-px ml-auto whitespace-nowrap border-b-2 border-transparent px-3 py-2.5 text-[13px] text-muted hover:text-foreground">
          Switch workspace
        </Link>
      )}
    </nav>
  );
}
