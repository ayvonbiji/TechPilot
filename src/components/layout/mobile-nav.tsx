"use client";

import { useState } from "react";
import { Dialog as D } from "radix-ui";
import { Menu, X } from "lucide-react";
import { SidebarContent } from "./sidebar";
import type { SwitcherWorkspace } from "./workspace-switcher";

export function MobileNav({ workspaces, currentId }: { workspaces: SwitcherWorkspace[]; currentId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <D.Root open={open} onOpenChange={setOpen}>
      <D.Trigger className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground lg:hidden">
        <Menu className="h-5 w-5" />
        <span className="sr-only">Open navigation</span>
      </D.Trigger>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-[#0b1424]/50 lg:hidden" />
        <D.Content className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] shadow-pop focus:outline-none lg:hidden">
          <D.Title className="sr-only">Navigation</D.Title>
          <D.Description className="sr-only">Move between sections of the app</D.Description>
          <SidebarContent workspaces={workspaces} currentId={currentId} onNavigate={() => setOpen(false)} />
          <D.Close className="absolute right-3 top-4 inline-flex h-8 w-8 items-center justify-center rounded-lg text-sidebar-muted hover:bg-sidebar-2 hover:text-white">
            <X className="h-4 w-4" />
            <span className="sr-only">Close navigation</span>
          </D.Close>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
