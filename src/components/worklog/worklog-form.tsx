"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody } from "@/components/ui/card";
import { Field, Input, Textarea, errorProps } from "@/components/ui/input";
import { FormError } from "@/components/shared/form-error";
import { PrivacyNotice } from "@/components/shared/privacy-notice";
import { useActionForm } from "@/components/shared/use-action-form";
import { createWorkLog, updateWorkLog } from "@/lib/actions/worklog";
import { workLogSchema } from "@/lib/validation/schemas";
import type { WorkLog } from "@/lib/types";
import { WORKLOG_FIELDS } from "./fields";

export function WorkLogForm({ entry, defaultDate }: { entry?: WorkLog; defaultDate: string }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(() => {
    const base: Record<string, string> = { log_date: entry?.log_date ?? defaultDate };
    WORKLOG_FIELDS.forEach((f) => (base[f.key] = entry ? String(entry[f.key] ?? "") : ""));
    return base;
  });
  const { pending, fieldErrors, formError, submit } = useActionForm(workLogSchema);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit(values, (input) => (entry ? updateWorkLog(entry.id, input) : createWorkLog(input)), {
          onSuccess: () => router.push(`/worklog?month=${values.log_date.slice(0, 7)}#d-${values.log_date}`),
        });
      }}
    >
      <PrivacyNotice />
      <FormError message={formError} />
      <Panel>
        <PanelBody className="space-y-5">
          <Field label="Date" htmlFor="log_date" required error={fieldErrors.log_date} className="max-w-56">
            <Input id="log_date" type="date" value={values.log_date} onChange={set("log_date")} {...errorProps("log_date", fieldErrors.log_date)} />
          </Field>
          {WORKLOG_FIELDS.map((f) => (
            <Field key={f.key} label={f.label} htmlFor={f.key} hint={f.hint} error={fieldErrors[f.key]}>
              <Textarea id={f.key} value={values[f.key]} onChange={set(f.key)} rows={f.key === "tasks_performed" ? 4 : 3} {...errorProps(f.key, fieldErrors[f.key])} />
            </Field>
          ))}
        </PanelBody>
      </Panel>
      <div className="flex justify-end gap-2">
        <Button asChild variant="secondary"><Link href="/worklog">Cancel</Link></Button>
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save entry"}</Button>
      </div>
    </form>
  );
}
