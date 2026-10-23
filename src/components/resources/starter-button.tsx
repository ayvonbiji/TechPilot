"use client";

import { useTransition } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { addStarterResources } from "@/lib/actions/bookmarks";

export function StarterResourcesButton({ variant = "secondary" }: { variant?: ButtonProps["variant"] }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant={variant}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await addStarterResources();
          if (res.ok) toast.success(res.message ?? "Added");
          else toast.error(res.error);
        })
      }
    >
      <Sparkles /> {pending ? "Adding…" : "Add recommended links"}
    </Button>
  );
}
