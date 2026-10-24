"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea, errorProps } from "@/components/ui/input";
import { FormError } from "@/components/shared/form-error";
import { useActionForm } from "@/components/shared/use-action-form";
import { createClientOrg, updateClientOrg } from "@/lib/actions/clients";
import { clientSchema } from "@/lib/validation/schemas";

export interface ClientValues {
  name: string;
  email: string;
  phone: string;
  address: string;
  primary_contact_name: string;
  primary_contact_email: string;
  service_notes: string;
  notes: string;
}

const EMPTY: ClientValues = { name: "", email: "", phone: "", address: "", primary_contact_name: "", primary_contact_email: "", service_notes: "", notes: "" };

function Fields({ values, set, errors }: { values: ClientValues; set: (k: keyof ClientValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void; errors: Record<string, string> }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Organisation name" htmlFor="c-name" required error={errors.name} className="sm:col-span-2">
        <Input id="c-name" value={values.name} onChange={set("name")} maxLength={120} {...errorProps("c-name", errors.name)} />
      </Field>
      <Field label="Primary contact" htmlFor="c-pcn" error={errors.primary_contact_name}>
        <Input id="c-pcn" value={values.primary_contact_name} onChange={set("primary_contact_name")} maxLength={120} />
      </Field>
      <Field label="Primary contact email" htmlFor="c-pce" error={errors.primary_contact_email}>
        <Input id="c-pce" type="email" value={values.primary_contact_email} onChange={set("primary_contact_email")} {...errorProps("c-pce", errors.primary_contact_email)} />
      </Field>
      <Field label="Organisation email" htmlFor="c-email" error={errors.email}>
        <Input id="c-email" type="email" value={values.email} onChange={set("email")} {...errorProps("c-email", errors.email)} />
      </Field>
      <Field label="Phone" htmlFor="c-phone" error={errors.phone}>
        <Input id="c-phone" type="tel" value={values.phone} onChange={set("phone")} maxLength={40} />
      </Field>
      <Field label="Address" htmlFor="c-address" error={errors.address} className="sm:col-span-2">
        <Textarea id="c-address" value={values.address} onChange={set("address")} rows={2} maxLength={500} />
      </Field>
      <Field label="Service settings" htmlFor="c-service" error={errors.service_notes} hint="Support hours, what's covered, escalation contacts." className="sm:col-span-2">
        <Textarea id="c-service" value={values.service_notes} onChange={set("service_notes")} rows={3} />
      </Field>
      <Field label="Internal notes" htmlFor="c-notes" error={errors.notes} hint="Staff only." className="sm:col-span-2">
        <Textarea id="c-notes" value={values.notes} onChange={set("notes")} rows={3} />
      </Field>
    </div>
  );
}

export function NewClientDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [values, setValues] = useState<ClientValues>(EMPTY);
  const { pending, fieldErrors, formError, submit } = useActionForm(clientSchema);
  const set = (k: keyof ClientValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValues((v) => ({ ...v, [k]: e.target.value }));
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      {open && (
        <DialogContent title="New client" description="A customer organisation you support." wide>
          <form
            noValidate
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              submit(values, createClientOrg, { onSuccess: (r) => router.push(`/clients/${r.data?.id}`) });
            }}
          >
            <FormError message={formError} />
            <Fields values={values} set={set} errors={fieldErrors} />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={pending}>{pending ? "Adding…" : "Add client"}</Button>
            </div>
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}

export function EditClientForm({ id, initial }: { id: string; initial: ClientValues }) {
  const [values, setValues] = useState<ClientValues>(initial);
  const { pending, fieldErrors, formError, submit } = useActionForm(clientSchema);
  const set = (k: keyof ClientValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValues((v) => ({ ...v, [k]: e.target.value }));
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit(values, (input) => updateClientOrg(id, input));
      }}
    >
      <FormError message={formError} />
      <Fields values={values} set={set} errors={fieldErrors} />
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save details"}</Button>
      </div>
    </form>
  );
}
