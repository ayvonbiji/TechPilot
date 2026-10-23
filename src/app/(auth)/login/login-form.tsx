"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, errorProps } from "@/components/ui/input";
import { FormError } from "@/components/shared/form-error";
import { useActionForm } from "@/components/shared/use-action-form";
import { signIn } from "@/lib/actions/auth";
import { signInSchema } from "@/lib/validation/schemas";

const MESSAGES: Record<string, string> = {
  confirmed: "Email confirmed. Sign in to continue.",
  "password-updated": "Password updated. Sign in with your new password.",
  deleted: "Your account and all its data have been deleted.",
};

export function LoginForm({ next, message }: { next?: string; message?: string }) {
  const [values, setValues] = useState({ email: "", password: "" });
  const { pending, fieldErrors, formError, submit } = useActionForm(signInSchema);
  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  return (
    <>
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="mt-1 text-sm text-muted">Welcome back. Pick up where you left off.</p>
      {message && MESSAGES[message] && (
        <p className="mt-4 rounded-lg border border-ok/30 bg-ok-soft px-3 py-2.5 text-[13px]" role="status">
          {MESSAGES[message]}
        </p>
      )}
      <form
        className="mt-6 space-y-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit(values, (input) => signIn(input, next));
        }}
      >
        <FormError message={formError} />
        <Field label="Email" htmlFor="email" error={fieldErrors.email}>
          <Input id="email" type="email" autoComplete="email" value={values.email} onChange={set("email")} {...errorProps("email", fieldErrors.email)} />
        </Field>
        <Field label="Password" htmlFor="password" error={fieldErrors.password}>
          <Input id="password" type="password" autoComplete="current-password" value={values.password} onChange={set("password")} {...errorProps("password", fieldErrors.password)} />
        </Field>
        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-[13px] text-accent hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" className="w-full" size="lg" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        New here?{" "}
        <Link href="/signup" className="font-medium text-accent hover:underline">
          Create an account
        </Link>
      </p>
    </>
  );
}
