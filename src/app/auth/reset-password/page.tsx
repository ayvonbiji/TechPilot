"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input, errorProps } from "@/components/ui/input";
import { FormError } from "@/components/shared/form-error";
import { useActionForm } from "@/components/shared/use-action-form";
import { updatePassword } from "@/lib/actions/auth";
import { newPasswordSchema } from "@/lib/validation/schemas";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [values, setValues] = useState({ password: "", confirm: "" });
  const { pending, fieldErrors, formError, submit } = useActionForm(newPasswordSchema);

  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-12">
      <div className="w-full max-w-[380px]">
        <h1 className="text-2xl font-semibold">Choose a new password</h1>
        <form
          className="mt-6 space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            submit(values, updatePassword, { onSuccess: () => router.push("/dashboard") });
          }}
        >
          <FormError message={formError} />
          <Field label="New password" htmlFor="password" error={fieldErrors.password} hint="At least 8 characters, with a letter and a number.">
            <Input id="password" type="password" autoComplete="new-password" value={values.password} onChange={(e) => setValues((v) => ({ ...v, password: e.target.value }))} {...errorProps("password", fieldErrors.password)} />
          </Field>
          <Field label="Confirm password" htmlFor="confirm" error={fieldErrors.confirm}>
            <Input id="confirm" type="password" autoComplete="new-password" value={values.confirm} onChange={(e) => setValues((v) => ({ ...v, confirm: e.target.value }))} {...errorProps("confirm", fieldErrors.confirm)} />
          </Field>
          <Button type="submit" className="w-full" size="lg" disabled={pending}>
            {pending ? "Saving…" : "Save new password"}
          </Button>
        </form>
      </div>
    </main>
  );
}
