"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody } from "@/components/ui/card";
import { Field, Input, Textarea, errorProps } from "@/components/ui/input";
import { FormError } from "@/components/shared/form-error";
import { Markdown } from "@/components/shared/markdown";
import { useActionForm } from "@/components/shared/use-action-form";
import { createNote, updateNote } from "@/lib/actions/notes";
import { NOTE_CATEGORIES } from "@/lib/constants";
import { noteSchema } from "@/lib/validation/schemas";
import type { Note } from "@/lib/types";
import { cn } from "@/lib/utils";

const STARTER = `## Purpose\n\n\n## Example\n\`\`\`\n\n\`\`\`\n\n## Precautions\n- `;

export function NoteForm({ note, categories }: { note?: Note; categories: string[] }) {
  const router = useRouter();
  const [values, setValues] = useState({
    title: note?.title ?? "",
    category: note?.category ?? "General",
    tags: note?.tags.join(", ") ?? "",
    content: note?.content ?? "",
    is_favorite: note?.is_favorite ?? false,
  });
  const [tab, setTab] = useState<"write" | "preview">("write");
  const { pending, fieldErrors, formError, submit } = useActionForm(noteSchema);
  const set = (k: "title" | "category" | "tags" | "content") => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));
  const allCategories = Array.from(new Set([...NOTE_CATEGORIES, ...categories]));

  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit(values, (input) => (note ? updateNote(note.id, input) : createNote(input)), {
          onSuccess: (res) => router.push(`/notes/${res.data?.id ?? note?.id ?? ""}`),
        });
      }}
    >
      <FormError message={formError} />
      <Panel>
        <PanelBody className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <Field label="Title" htmlFor="title" required error={fieldErrors.title}>
            <Input id="title" value={values.title} onChange={set("title")} maxLength={200} {...errorProps("title", fieldErrors.title)} />
          </Field>
          <Field label="Category" htmlFor="category" required error={fieldErrors.category}>
            <Input id="category" list="note-categories" value={values.category} onChange={set("category")} maxLength={60} {...errorProps("category", fieldErrors.category)} />
            <datalist id="note-categories">{allCategories.map((c) => <option key={c} value={c} />)}</datalist>
          </Field>
          <Field label="Tags" htmlFor="tags" hint="Comma-separated" error={fieldErrors.tags}>
            <Input id="tags" value={values.tags} onChange={set("tags")} {...errorProps("tags", fieldErrors.tags)} />
          </Field>
        </PanelBody>
      </Panel>

      <Panel>
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
          <div role="tablist" aria-label="Editor mode" className="flex gap-1">
            {(["write", "preview"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={cn(
                  "cursor-pointer rounded-md px-3 py-1.5 text-[13px] font-medium capitalize",
                  tab === t ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground",
                )}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            {!values.content && tab === "write" && (
              <button type="button" className="cursor-pointer text-[13px] text-accent hover:underline" onClick={() => setValues((v) => ({ ...v, content: STARTER }))}>
                Use command template
              </button>
            )}
            <span className="hidden text-[12px] text-subtle sm:inline">Markdown supported; wrap commands in ``` fences</span>
          </div>
        </div>
        {tab === "write" ? (
          <div className="p-3">
            <Textarea
              id="content"
              aria-label="Note content"
              value={values.content}
              onChange={set("content")}
              rows={20}
              className="border-0 font-mono text-[13px] focus-visible:ring-0"
              placeholder="Write in Markdown…"
              {...errorProps("content", fieldErrors.content)}
            />
            {fieldErrors.content && <p className="px-3 text-[13px] text-danger" role="alert">{fieldErrors.content}</p>}
          </div>
        ) : (
          <div className="min-h-[300px] px-5 py-4">
            {values.content.trim() ? <Markdown>{values.content}</Markdown> : <p className="text-sm text-muted">Nothing to preview yet.</p>}
          </div>
        )}
      </Panel>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={values.is_favorite} onChange={(e) => setValues((v) => ({ ...v, is_favorite: e.target.checked }))} />
          Add to favourites
        </label>
        <div className="flex gap-2">
          <Button asChild variant="secondary"><Link href={note ? `/notes/${note.id}` : "/notes"}>Cancel</Link></Button>
          <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save note"}</Button>
        </div>
      </div>
    </form>
  );
}
