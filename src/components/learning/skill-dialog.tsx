"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Dialog, DialogContent, ConfirmDialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea, errorProps } from "@/components/ui/input";
import { FormError } from "@/components/shared/form-error";
import { useActionForm } from "@/components/shared/use-action-form";
import { createSkill, deleteSkill, updateSkill } from "@/lib/actions/skills";
import { PROFICIENCY_LEVELS, SKILL_CATEGORIES, SKILL_STATUSES } from "@/lib/constants";
import { skillSchema } from "@/lib/validation/schemas";
import type { Skill } from "@/lib/types";

type Values = Record<"name" | "kind" | "category" | "current_level" | "target_level" | "status" | "notes" | "resources" | "completed_on", string>;

function blank(kind: string, category: string): Values {
  return { name: "", kind, category, current_level: "0", target_level: "3", status: "not_started", notes: "", resources: "", completed_on: "" };
}

export function SkillDialog({ skills, today }: { skills: Skill[]; today: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const editId = params.get("edit");
  const newKind = params.get("new");
  const skill = editId ? skills.find((s) => s.id === editId) ?? null : null;
  const open = !!skill || newKind === "skill" || newKind === "certification";
  const presetCategory = params.get("category") ?? SKILL_CATEGORIES[0];

  const [values, setValues] = useState<Values>(blank("skill", SKILL_CATEGORIES[0]));
  const [confirm, setConfirm] = useState(false);
  const [deleting, startDelete] = useTransition();
  const { pending, fieldErrors, formError, setFieldErrors, submit } = useActionForm(skillSchema);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValues(
      skill
        ? {
            name: skill.name,
            kind: skill.kind,
            category: skill.category,
            current_level: String(skill.current_level),
            target_level: String(skill.target_level),
            status: skill.status,
            notes: skill.notes,
            resources: skill.resources,
            completed_on: skill.completed_on ?? "",
          }
        : blank(newKind === "certification" ? "certification" : "skill", (SKILL_CATEGORIES as readonly string[]).includes(presetCategory) ? presetCategory : SKILL_CATEGORIES[0]),
    );
    setFieldErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skill?.id, newKind]);

  function close() {
    const next = new URLSearchParams(params.toString());
    ["new", "edit", "category"].forEach((k) => next.delete(k));
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const set = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const value = e.target.value;
    setValues((v) => {
      const next = { ...v, [k]: value };
      if (k === "status" && value === "completed" && !v.completed_on) next.completed_on = today;
      if (k === "status" && value === "completed" && Number(v.current_level) < Number(v.target_level)) next.current_level = v.target_level;
      return next;
    });
  };

  const isCert = values.kind === "certification";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      {open && (
        <DialogContent title={skill ? `Edit ${isCert ? "certification" : "skill"}` : isCert ? "Add a certification" : "Add a skill"} wide>
          <form
            noValidate
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              submit(values, (input) => (skill ? updateSkill(skill.id, input) : createSkill(input)), { onSuccess: close });
            }}
          >
            <FormError message={formError} />
            <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <Field label="Name" htmlFor="name" required error={fieldErrors.name}>
                <Input id="name" value={values.name} onChange={set("name")} maxLength={120} autoFocus placeholder={isCert ? "e.g. CompTIA A+" : "e.g. Subnetting"} {...errorProps("name", fieldErrors.name)} />
              </Field>
              <Field label="Type" htmlFor="kind">
                <Select id="kind" value={values.kind} onChange={set("kind")}>
                  <option value="skill">Skill</option>
                  <option value="certification">Certification</option>
                </Select>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Category" htmlFor="category" error={fieldErrors.category}>
                <Select id="category" value={values.category} onChange={set("category")}>
                  {SKILL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </Field>
              <Field label="Learning status" htmlFor="status" error={fieldErrors.status}>
                <Select id="status" value={values.status} onChange={set("status")}>
                  {SKILL_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </Select>
              </Field>
              <Field label="Current proficiency" htmlFor="current_level" error={fieldErrors.current_level}>
                <Select id="current_level" value={values.current_level} onChange={set("current_level")}>
                  {PROFICIENCY_LEVELS.map((l) => <option key={l.value} value={l.value}>{l.value}: {l.label}</option>)}
                </Select>
              </Field>
              <Field label="Target proficiency" htmlFor="target_level" error={fieldErrors.target_level}>
                <Select id="target_level" value={values.target_level} onChange={set("target_level")}>
                  {PROFICIENCY_LEVELS.filter((l) => l.value > 0).map((l) => <option key={l.value} value={l.value}>{l.value}: {l.label}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="Completion date" htmlFor="completed_on" error={fieldErrors.completed_on} hint={values.status === "completed" ? "Required when completed" : "Optional"} className="sm:max-w-56">
              <Input id="completed_on" type="date" value={values.completed_on} onChange={set("completed_on")} {...errorProps("completed_on", fieldErrors.completed_on)} />
            </Field>
            <Field label="Notes" htmlFor="notes" error={fieldErrors.notes}>
              <Textarea id="notes" value={values.notes} onChange={set("notes")} rows={3} placeholder="What you can do now, what's next" />
            </Field>
            <Field label="Resources" htmlFor="resources" error={fieldErrors.resources} hint="Courses, books, labs or links — one per line.">
              <Textarea id="resources" value={values.resources} onChange={set("resources")} rows={3} />
            </Field>
            <div className="flex items-center justify-between gap-2 pt-2">
              {skill ? (
                <Button variant="danger-ghost" onClick={() => setConfirm(true)}><Trash2 /> Delete</Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button variant="secondary" onClick={close}>Cancel</Button>
                <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
              </div>
            </div>
          </form>
          {skill && (
            <ConfirmDialog
              open={confirm}
              onOpenChange={setConfirm}
              title={`Delete "${skill.name}"?`}
              description="It will be removed from your tracker permanently."
              pending={deleting}
              onConfirm={() =>
                startDelete(async () => {
                  const res = await deleteSkill(skill.id);
                  if (res.ok) {
                    toast.success("Deleted");
                    setConfirm(false);
                    close();
                  } else toast.error(res.error);
                })
              }
            />
          )}
        </DialogContent>
      )}
    </Dialog>
  );
}
