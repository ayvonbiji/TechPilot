"use client";

import Link from "next/link";
import { useTransition } from "react";
import { LogOut, Settings } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown";
import { signOut } from "@/lib/actions/auth";

export function UserMenu({ name, email, settingsHref = "/settings" }: { name: string; email: string; settingsHref?: string }) {
  const [pending, start] = useTransition();
  const initials =
    (name || email)
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase())
      .join("") || "U";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg p-1 pr-2 hover:bg-surface-2 focus-visible:outline-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar text-[12px] font-semibold text-white">
          {initials}
        </span>
        <span className="hidden max-w-36 truncate text-sm font-medium sm:block">{name || email}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>
          <span className="block truncate font-medium text-foreground">{name || "Your account"}</span>
          <span className="block truncate">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={settingsHref}>
            <Settings /> Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem disabled={pending} onSelect={() => start(() => signOut())}>
          <LogOut /> {pending ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
