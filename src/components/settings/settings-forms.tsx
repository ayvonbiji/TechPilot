"use client";

import { useMemo, useState, useTransition } from "react";
import { useTheme } from "next-themes";
import { Database, Download, LogOut, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/card";
import { Field, Input, Select, errorProps } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/dialog";
import { FormError } from "@/components/shared/form-error";
import { useActionForm } from "@/components/shared/use-action-form";
import { deleteAccount, loadDemoData, removeDemoData, updateProfile } from "@/lib/actions/settings";
import { signOut, updatePassword } from "@/lib/actions/auth";
import { DATE_FORMATS } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/dates";
import { newPasswordSchema, profileSchema } from "@/lib/validation/schemas";
import type { Profile } from "@/lib/types";

const SAMPLE_DATE = "2026-03-09";

export function ProfileForm({ profile, email }: { profile: Profile; email: string }) {
  const { setTheme } = useTheme();
  const [values, setValues] = useState({
    display_name: profile.display_name,
    theme: profile.theme,
    timezone: profile.timezone,
    date_format: profile.date_format,
    time_format: profile.time_format,
  });
  const { pending, fieldErrors, formError, submit } = useActionForm(profileSchema);
  const zones = useMemo(() => {
    try {
      return (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf("timeZone");
    } catch {
      return [profile.timezone];
    }
  }, [profile.timezone]);
  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));
  const detected = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined;

  return (
    <Panel id="profile">
      <PanelHeader title="Profile and display" description="How your name, dates and times appear." />
      <PanelBody>
        <form
          noValidate
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit(values, updateProfile, {
              onSuccess: () => {
                setTheme(values.theme);
                try {
                  sessionStorage.setItem("itec-theme-synced", values.theme);
                } catch {}
              },
            });
          }}
        >
          <FormError message={formError} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Display name" htmlFor="display_name" error={fieldErrors.display_name}>
              <Input id="display_name" value={values.display_name} onChange={set("display_name")} maxLength={80} {...errorProps("display_name", fieldErrors.display_name)} />
            </Field>
            <Field label="Email" htmlFor="email" hint="Used to sign in. Change it in your Supabase project if needed.">
              <Input id="email" value={email} disabled readOnly />
            </Field>
            <Field label="Theme" htmlFor="theme">
              <Select id="theme" value={values.theme} onChange={set("theme")}>
                <option value="system">Match my device</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </Select>
            </Field>
            <Field
              label="Time zone"
              htmlFor="timezone"
              error={fieldErrors.timezone}
              hint={detected && detected !== values.timezone ? undefined : "Decides what counts as 'today' for due dates and reports."}
            >
              <Select id="timezone" value={values.timezone} onChange={set("timezone")}>
                {!zones.includes(values.timezone) && <option value={values.timezone}>{values.timezone}</option>}
                {zones.map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}
              </Select>
              {detected && detected !== values.timezone && (
                <button type="button" className="self-start cursor-pointer text-[13px] text-accent hover:underline" onClick={() => setValues((v) => ({ ...v, timezone: detected }))}>
                  Use this device&apos;s time zone ({detected.replace(/_/g, " ")})
                </button>
              )}
            </Field>
            <Field label="Date format" htmlFor="date_format">
              <Select id="date_format" value={values.date_format} onChange={set("date_format")}>
                {DATE_FORMATS.map((f) => <option key={f} value={f}>{formatDate(SAMPLE_DATE, f)}</option>)}
              </Select>
            </Field>
            <Field label="Time format" htmlFor="time_format">
              <Select id="time_format" value={values.time_format} onChange={set("time_format")}>
                <option value="24h">24-hour ({formatDateTime("2026-03-09T14:30:00Z", { tz: "UTC", timeFormat: "24h" }).split(", ")[1]})</option>
                <option value="12h">12-hour ({formatDateTime("2026-03-09T14:30:00Z", { tz: "UTC", timeFormat: "12h" }).split(", ")[1]})</option>
              </Select>
            </Field>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save settings"}</Button>
          </div>
        </form>
      </PanelBody>
    </Panel>
  );
}

export function PasswordForm() {
  const [values, setValues] = useState({ password: "", confirm: "" });
  const { pending, fieldErrors, formError, submit } = useActionForm(newPasswordSchema);
  return (
    <Panel>
      <PanelHeader title="Password" />
      <PanelBody>
        <form
          noValidate
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit(values, updatePassword, { onSuccess: () => setValues({ password: "", confirm: "" }) });
          }}
        >
          <FormError message={formError} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="New password" htmlFor="password" error={fieldErrors.password} hint="At least 8 characters, with a letter and a number.">
              <Input id="password" type="password" autoComplete="new-password" value={values.password} onChange={(e) => setValues((v) => ({ ...v, password: e.target.value }))} {...errorProps("password", fieldErrors.password)} />
            </Field>
            <Field label="Confirm new password" htmlFor="confirm" error={fieldErrors.confirm}>
              <Input id="confirm" type="password" autoComplete="new-password" value={values.confirm} onChange={(e) => setValues((v) => ({ ...v, confirm: e.target.value }))} {...errorProps("confirm", fieldErrors.confirm)} />
            </Field>
          </div>
          <div className="flex justify-end">
            <Button type="submit" variant="secondary" disabled={pending}>{pending ? "Updating…" : "Update password"}</Button>
          </div>
        </form>
      </PanelBody>
    </Panel>
  );
}

export function DemoDataPanel({ hasDemo }: { hasDemo: boolean }) {
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) =>
    start(async () => {
      const res = await fn();
      if (res.ok) toast.success(res.message ?? "Done");
      else toast.error(res.error ?? "Something went wrong");
      setConfirm(false);
    });
  return (
    <Panel id="demo">
      <PanelHeader title="Demo data" description="Fictional tasks, records, notes, logs and skills for exploring the app." />
      <PanelBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-[56ch] text-sm text-muted">
          {hasDemo
            ? "Demo data is loaded. Every demo item has a Demo badge. Removing it leaves your own data untouched."
            : "Load a small fictional data set. It contains no real companies, people or addresses and is clearly labelled."}
        </p>
        {hasDemo ? (
          <Button variant="secondary" disabled={pending} onClick={() => setConfirm(true)}><Trash2 /> Remove demo data</Button>
        ) : (
          <Button variant="secondary" disabled={pending} onClick={() => run(loadDemoData)}><Database /> {pending ? "Loading…" : "Load demo data"}</Button>
        )}
      </PanelBody>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Remove all demo data?"
        description="Every item marked Demo is deleted. Your own entries stay as they are."
        confirmLabel="Remove demo data"
        pending={pending}
        onConfirm={() => run(removeDemoData)}
      />
    </Panel>
  );
}

export function DataPanel() {
  return (
    <Panel id="data">
      <PanelHeader title="Your data" description="Export and back up everything you've saved." />
      <PanelBody className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">Download a complete JSON copy of your profile, tasks, records, notes, logs, skills and links.</p>
          <Button asChild variant="secondary"><a href="/api/export" download><Download /> Export all data</a></Button>
        </div>
        <div className="rounded-lg border border-border bg-surface-2 px-4 py-3 text-[13px] leading-relaxed">
          <p className="font-medium">Backup guidance</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-muted">
            <li>Export monthly, and before changing jobs or devices, so your knowledge base goes with you.</li>
            <li>Store exports somewhere private (an encrypted drive or personal cloud storage), not on a work device.</li>
            <li>Paid Supabase plans include automatic daily database backups; on the free plan, your exports are the backup.</li>
            <li>For tasks in a spreadsheet, use the CSV download on the Reports page.</li>
          </ul>
        </div>
      </PanelBody>
    </Panel>
  );
}

export function AccountPanel() {
  const [signingOut, startSignOut] = useTransition();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const { pending, fieldErrors, formError, submit } = useActionForm(null);

  return (
    <Panel className="border-danger/30">
      <PanelHeader title="Account" />
      <PanelBody className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">Sign out of this device.</p>
          <Button variant="secondary" disabled={signingOut} onClick={() => startSignOut(() => signOut())}><LogOut /> {signingOut ? "Signing out…" : "Sign out"}</Button>
        </div>
        <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-danger">Delete account</p>
            <p className="text-sm text-muted">Permanently deletes your account and everything in it. Export first if you want a copy.</p>
          </div>
          <Button variant="danger" onClick={() => setOpen(true)}><Trash2 /> Delete account</Button>
        </div>
      </PanelBody>
      <ConfirmDialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setText("");
        }}
        title="Delete your account?"
        confirmLabel="Delete account permanently"
        pending={pending}
        description={
          <div className="space-y-3">
            <p>All tasks, records, notes, work logs, skills and links are deleted immediately. This can&apos;t be undone.</p>
            <FormError message={formError && !fieldErrors.confirm ? formError : null} />
            <Field label="Type DELETE to confirm" htmlFor="confirm-delete" error={fieldErrors.confirm}>
              <Input id="confirm-delete" value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" {...errorProps("confirm", fieldErrors.confirm)} />
            </Field>
          </div>
        }
        onConfirm={() => submit(text, (input) => deleteAccount(String(input)))}
      />
    </Panel>
  );
}
