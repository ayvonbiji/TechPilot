"use client";

import Link from "next/link";
import { useState } from "react";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, errorProps } from "@/components/ui/input";
import { FormError } from "@/components/shared/form-error";
import { useActionForm } from "@/components/shared/use-action-form";
import { signUp } from "@/lib/actions/auth";
import { signUpSchema } from "@/lib/validation/schemas";

export function SignupForm() {
  const [values, setValues] = useState({ displayName: "", email: "", password: "" });
  const [sentTo, setSentTo] = useState<string | null>(null);
  const { pending, fieldErrors, formError, submit } = useActionForm(signUpSchema);
  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  if (sentTo) {
    return (
      <div>
        <MailCheck className="h-8 w-8 text-ok" aria-hidden />
        <h1 className="mt-4 text-2xl font-semibold">Check your email</h1>
        <p className="mt-2 text-sm text-muted">
          We sent a confirmation link to <span className="font-medium text-foreground">{sentTo}</span>. Open it to
          activate your account, then sign in.
        </p>
        <Button asChild variant="secondary" className="mt-6">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-semibold">Create your account</h1>
      <p className="mt-1 text-sm text-muted">Your workspace is private. Only you can see what you save.</p>
      <form
        className="mt-6 space-y-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit(values, signUp, { onSuccess: () => setSentTo(values.email.trim()) });
        }}
      >
        <FormError message={formError} />
        <Field label="Display name" htmlFor="displayName" error={fieldErrors.displayName}>
          <Input id="displayName" autoComplete="nickname" value={values.displayName} onChange={set("displayName")} {...errorProps("displayName", fieldErrors.displayName)} />
        </Field>
        <Field label="Email" htmlFor="email" error={fieldErrors.email}>
          <Input id="email" type="email" autoComplete="email" value={values.email} onChange={set("email")} {...errorProps("email", fieldErrors.email)} />
        </Field>
        <Field label="Password" htmlFor="password" error={fieldErrors.password} hint="At least 8 characters, with a letter and a number.">
          <Input id="password" type="password" autoComplete="new-password" value={values.password} onChange={set("password")} {...errorProps("password", fieldErrors.password)} />
        </Field>
        <Button type="submit" className="w-full" size="lg" disabled={pending}>
          {pending ? "Creating account…" : "Create account"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
