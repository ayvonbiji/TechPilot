"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea, errorProps } from "@/components/ui/input";
import { FormError } from "@/components/shared/form-error";
import { useActionForm } from "@/components/shared/use-action-form";
import { createBookmark, updateBookmark } from "@/lib/actions/bookmarks";
import { BOOKMARK_CATEGORIES } from "@/lib/constants";
import { bookmarkSchema } from "@/lib/validation/schemas";
import type { Bookmark } from "@/lib/types";

export function BookmarkDialog({ bookmarks }: { bookmarks: Bookmark[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const editId = params.get("edit");
  const bookmark = editId ? bookmarks.find((b) => b.id === editId) ?? null : null;
  const open = params.get("new") === "1" || !!bookmark;
  const [values, setValues] = useState({ title: "", url: "https://", category: BOOKMARK_CATEGORIES[0] as string, notes: "" });
  const { pending, fieldErrors, formError, setFieldErrors, submit } = useActionForm(bookmarkSchema);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValues(bookmark ? { title: bookmark.title, url: bookmark.url, category: bookmark.category, notes: bookmark.notes } : { title: "", url: "https://", category: BOOKMARK_CATEGORIES[0], notes: "" });
    setFieldErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookmark?.id, open]);

  function close() {
    const next = new URLSearchParams(params.toString());
    next.delete("new");
    next.delete("edit");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }
  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      {open && (
        <DialogContent title={bookmark ? "Edit link" : "Save a link"}>
          <form
            noValidate
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              submit(values, (input) => (bookmark ? updateBookmark(bookmark.id, input) : createBookmark(input)), { onSuccess: close });
            }}
          >
            <FormError message={formError} />
            <Field label="URL" htmlFor="url" required error={fieldErrors.url}>
              <Input id="url" type="url" inputMode="url" value={values.url} onChange={set("url")} autoFocus {...errorProps("url", fieldErrors.url)} />
            </Field>
            <Field label="Title" htmlFor="title" required error={fieldErrors.title}>
              <Input id="title" value={values.title} onChange={set("title")} maxLength={200} {...errorProps("title", fieldErrors.title)} />
            </Field>
            <Field label="Category" htmlFor="category" error={fieldErrors.category}>
              <Select id="category" value={values.category} onChange={set("category")}>
                {BOOKMARK_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Notes" htmlFor="notes" hint="Optional" error={fieldErrors.notes}>
              <Textarea id="notes" value={values.notes} onChange={set("notes")} rows={3} maxLength={2000} />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={close}>Cancel</Button>
              <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save link"}</Button>
            </div>
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}
