"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, errorProps } from "@/components/ui/input";
import { FormError } from "@/components/shared/form-error";
import { useActionForm } from "@/components/shared/use-action-form";
import { requestPasswordReset } from "@/lib/actions/auth";
import { emailSchema } from "@/lib/validation/schemas";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const { pending, fieldErrors, formError, submit } = useActionForm(emailSchema);

  return (
    <>
      <h1 className="text-2xl font-semibold">Reset your password</h1>
      <p className="mt-1 text-sm text-muted">Enter your account email and we&apos;ll send a reset link.</p>
      {done ? (
        <p className="mt-6 rounded-lg border border-ok/30 bg-ok-soft px-3 py-2.5 text-[13px]" role="status">{done}</p>
      ) : (
        <form
          className="mt-6 space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            submit({ email }, requestPasswordReset, { successToast: false, onSuccess: (r) => setDone(r.message ?? "Check your email.") });
          }}
        >
          <FormError message={formError} />
          <Field label="Email" htmlFor="email" error={fieldErrors.email}>
            <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} {...errorProps("email", fieldErrors.email)} />
          </Field>
          <Button type="submit" className="w-full" size="lg" disabled={pending}>
            {pending ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="text-accent hover:underline">Back to sign in</Link>
      </p>
    </>
  );
}
