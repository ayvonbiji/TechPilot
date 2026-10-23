"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { switchWorkspace } from "@/lib/actions/workspaces";
import { cn } from "@/lib/utils";

export function SwitchList({ items, currentId }: { items: { id: string; name: string; detail: string; portal: boolean }[]; currentId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <ul className="mt-6 space-y-2">
      {items.map((i) => (
        <li key={i.id}>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await switchWorkspace(i.id);
                if (!r.ok) return void toast.error(r.error);
                router.push(i.portal ? "/portal" : "/dashboard");
                router.refresh();
              })
            }
            className={cn(
              "flex w-full cursor-pointer items-center gap-3 rounded-xl border bg-surface px-4 py-3 text-left hover:border-border-strong",
              i.id === currentId ? "border-accent" : "border-border",
            )}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{i.name}</span>
              <span className="text-[13px] text-muted">{i.detail}</span>
            </span>
            {i.id === currentId && <Check className="h-4 w-4 text-accent" aria-label="Current" />}
          </button>
        </li>
      ))}
    </ul>
  );
}
