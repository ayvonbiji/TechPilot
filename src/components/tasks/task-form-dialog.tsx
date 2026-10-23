"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea, errorProps } from "@/components/ui/input";
import { FormError } from "@/components/shared/form-error";
import { useActionForm } from "@/components/shared/use-action-form";
import { createTask, updateTask } from "@/lib/actions/tasks";
import { PRIORITIES, TASK_CATEGORIES, TASK_STATUSES } from "@/lib/constants";
import { taskSchema } from "@/lib/validation/schemas";
import type { Task } from "@/lib/types";

type Values = {
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  due_date: string;
  completion_notes: string;
};

const empty = (today: string): Values => ({
  title: "",
  description: "",
  category: "General",
  priority: "medium",
  status: "pending",
  due_date: today,
  completion_notes: "",
});

function fromTask(t: Task): Values {
  return {
    title: t.title,
    description: t.description,
    category: t.category,
    priority: t.priority,
    status: t.status,
    due_date: t.due_date ?? "",
    completion_notes: t.completion_notes,
  };
}

/**
 * Create/edit dialog driven by the URL: ?new=1 opens a blank form, ?edit=<id> edits that task.
 * This lets the dashboard and other pages deep-link straight into the form.
 */
export function TaskFormDialog({ tasks, today, editTask }: { tasks: Task[]; today: string; editTask?: Task | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const editId = params.get("edit");
  const isNew = params.get("new") === "1";
  const task = editId ? (editTask ?? tasks.find((t) => t.id === editId) ?? null) : null;
  const open = isNew || !!task;

  const [values, setValues] = useState<Values>(empty(today));
  const { pending, fieldErrors, formError, setFieldErrors, submit } = useActionForm(taskSchema);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValues(task ? fromTask(task) : empty(today));
    setFieldErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id, isNew]);

  function close() {
    const next = new URLSearchParams(params.toString());
    next.delete("new");
    next.delete("edit");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const set = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      {open && (
        <DialogContent title={task ? "Edit task" : "New task"} description={task ? undefined : "Plan a piece of work, practice or learning."} wide>
          <form
            noValidate
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              submit(values, (input) => (task ? updateTask(task.id, input) : createTask(input)), { onSuccess: close });
            }}
          >
            <FormError message={formError} />
            <Field label="Title" htmlFor="title" required error={fieldErrors.title}>
              <Input id="title" value={values.title} onChange={set("title")} maxLength={200} autoFocus placeholder="e.g. Practise printer installation" {...errorProps("title", fieldErrors.title)} />
            </Field>
            <Field label="Description" htmlFor="description" error={fieldErrors.description}>
              <Textarea id="description" value={values.description} onChange={set("description")} rows={3} {...errorProps("description", fieldErrors.description)} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Category" htmlFor="category" required error={fieldErrors.category}>
                <Input id="category" list="task-categories" value={values.category} onChange={set("category")} maxLength={60} {...errorProps("category", fieldErrors.category)} />
                <datalist id="task-categories">
                  {TASK_CATEGORIES.map((c) => <option key={c} value={c} />)}
                </datalist>
              </Field>
              <Field label="Due date" htmlFor="due_date" error={fieldErrors.due_date} hint="Optional">
                <Input id="due_date" type="date" value={values.due_date} onChange={set("due_date")} {...errorProps("due_date", fieldErrors.due_date)} />
              </Field>
              <Field label="Priority" htmlFor="priority" error={fieldErrors.priority}>
                <Select id="priority" value={values.priority} onChange={set("priority")}>
                  {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </Select>
              </Field>
              <Field label="Status" htmlFor="status" error={fieldErrors.status}>
                <Select id="status" value={values.status} onChange={set("status")}>
                  {TASK_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </Select>
              </Field>
            </div>
            {(values.status === "completed" || values.completion_notes) && (
              <Field label="Completion notes" htmlFor="completion_notes" error={fieldErrors.completion_notes} hint="What you did and how it turned out.">
                <Textarea id="completion_notes" value={values.completion_notes} onChange={set("completion_notes")} rows={3} />
              </Field>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={close}>Cancel</Button>
              <Button type="submit" disabled={pending}>{pending ? "Saving…" : task ? "Save task" : "Add task"}</Button>
            </div>
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}
