"use client";

import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/shared/form-error";
import { acceptInvitation } from "@/lib/actions/workspaces";

export function AcceptInviteButton({ token }: { token: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      <FormError message={error} />
      <Button
        size="lg"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await acceptInvitation(token);
            if (res && !res.ok) setError(res.error);
          })
        }
      >
        {pending ? "Joining…" : "Accept invitation"}
      </Button>
    </div>
  );
}
