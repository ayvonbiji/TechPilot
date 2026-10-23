"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import type { ActionResult } from "@/lib/types";

export function DeleteButton({
  action,
  itemLabel,
  redirectTo,
  variant = "danger-ghost",
  size = "sm",
  iconOnly,
}: {
  action: () => Promise<ActionResult>;
  itemLabel: string;
  redirectTo?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  iconOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <>
      <Button variant={variant} size={iconOnly ? "icon-sm" : size} onClick={() => setOpen(true)} aria-label={`Delete ${itemLabel}`}>
        <Trash2 />
        {!iconOnly && "Delete"}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Delete ${itemLabel}?`}
        description="This permanently removes it. This can't be undone."
        pending={pending}
        onConfirm={() =>
          start(async () => {
            const res = await action();
            if (res.ok) {
              toast.success(res.message ?? "Deleted");
              setOpen(false);
              if (redirectTo) router.push(redirectTo);
            } else {
              toast.error(res.error);
            }
          })
        }
      />
    </>
  );
}
