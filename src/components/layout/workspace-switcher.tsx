"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown";
import { switchWorkspace } from "@/lib/actions/workspaces";
import { cn } from "@/lib/utils";

export interface SwitcherWorkspace {
  id: string;
  name: string;
  type: "personal" | "freelance" | "organisation";
  role: "owner" | "admin" | "agent" | "client";
  brand_color: string | null;
  logo_url: string | null;
}

const TYPE: Record<SwitcherWorkspace["type"], string> = { personal: "Personal", freelance: "Freelance", organisation: "Organisation" };
const ROLE: Record<SwitcherWorkspace["role"], string> = { owner: "Owner", admin: "Administrator", agent: "Technician", client: "Client" };

export function WorkspaceMark({ ws, size = "md" }: { ws: Pick<SwitcherWorkspace, "name" | "brand_color" | "logo_url" | "type">; size?: "sm" | "md" }) {
  const initials = ws.type === "personal" ? "Me" : ws.name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");
  const dim = size === "sm" ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-[12px]";
  if (ws.logo_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={ws.logo_url} alt="" className={cn(dim, "shrink-0 rounded-md bg-white object-contain")} referrerPolicy="no-referrer" />;
  }
  return (
    <span
      aria-hidden
      className={cn(dim, "flex shrink-0 items-center justify-center rounded-md font-semibold text-white")}
      style={{ background: ws.brand_color ?? (ws.type === "personal" ? "#22385a" : "#2f5bea") }}
    >
      {initials}
    </span>
  );
}

export function WorkspaceSwitcher({ workspaces, currentId }: { workspaces: SwitcherWorkspace[]; currentId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const current = workspaces.find((w) => w.id === currentId) ?? workspaces[0];

  function pick(id: string) {
    if (id === currentId) return;
    start(async () => {
      const res = await switchWorkspace(id);
      if (!res.ok) toast.error(res.error);
      else router.push("/dashboard");
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex w-full items-center gap-2.5 rounded-lg border border-white/10 bg-sidebar-2 px-2.5 py-2 text-left text-white transition-colors hover:bg-sidebar-active disabled:opacity-60"
        disabled={pending}
        aria-label={`Current workspace: ${current.name}. Switch workspace`}
      >
        <WorkspaceMark ws={current} />
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-[13px] font-medium">{current.name}</span>
          <span className="block truncate text-[11px] text-sidebar-muted">
            {TYPE[current.type]}
            {current.type !== "personal" && `, ${ROLE[current.role]}`}
          </span>
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-sidebar-muted" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        {workspaces.map((w) => (
          <DropdownMenuItem key={w.id} onSelect={() => pick(w.id)}>
            <WorkspaceMark ws={w} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate">{w.name}</span>
              <span className="block text-[11px] text-muted">{w.type === "personal" ? "Personal" : `${TYPE[w.type]}, ${ROLE[w.role]}`}</span>
            </span>
            {w.id === current.id && <Check className="text-accent" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/workspaces/new"><Plus /> New workspace</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
