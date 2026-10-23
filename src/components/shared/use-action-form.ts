"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { z } from "zod";
import { validate } from "@/lib/validation/common";
import type { ActionResult } from "@/lib/types";

/**
 * Validates on the client with the same Zod schema the Server Action uses,
 * then calls the action and surfaces field errors, a form error or a toast.
 */
export function useActionForm<S extends z.ZodType>(schema: S | null) {
  const [pending, start] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function submit<R = undefined>(
    values: unknown,
    action: (input: unknown) => Promise<ActionResult<R> | void>,
    opts: { onSuccess?: (res: Extract<ActionResult<R>, { ok: true }>) => void; successToast?: boolean } = {},
  ) {
    setFormError(null);
    if (schema) {
      const v = validate(schema, values);
      if (!v.success) {
        setFieldErrors(v.fieldErrors);
        const firstKey = Object.keys(v.fieldErrors)[0];
        if (firstKey) document.getElementById(firstKey)?.focus();
        return;
      }
    }
    setFieldErrors({});
    start(async () => {
      try {
        const res = await action(values);
        if (!res) return; // action redirected
        if (res.ok) {
          if (opts.successToast !== false && res.message) toast.success(res.message);
          opts.onSuccess?.(res);
        } else {
          setFieldErrors(res.fieldErrors ?? {});
          setFormError(res.error);
        }
      } catch (e) {
        // redirect() inside a Server Action surfaces as a thrown navigation; let Next handle it.
        if (e && typeof e === "object" && "digest" in e && String((e as { digest: string }).digest).startsWith("NEXT_REDIRECT")) throw e;
        setFormError("Something went wrong. Check your connection and try again.");
      }
    });
  }

  return { pending, fieldErrors, formError, setFieldErrors, submit };
}
