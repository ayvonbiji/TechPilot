"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CircleCheck, Ellipsis, Pencil, RotateCcw, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown";
import { deleteTask, setTaskStatus } from "@/lib/actions/tasks";
import type { Task } from "@/lib/types";

export function useEditLink() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (id: string) => {
    const next = new URLSearchParams(params.toString());
    next.delete("new");
    next.set("edit", id);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };
}

/** One-click complete / reopen toggle shown at the start of each row. */
export function CompleteToggle({ task }: { task: Task }) {
  const [pending, start] = useTransition();
  const done = task.status === "completed";
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await setTaskStatus(task.id, done ? "pending" : "completed");
          if (res.ok) toast.success(done ? "Reopened" : "Marked as completed");
          else toast.error(res.error);
        })
      }
      className={`flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 transition-colors disabled:opacity-50 ${
        done ? "border-ok bg-ok text-white" : "border-border-strong hover:border-ok"
      }`}
      aria-label={done ? `Reopen "${task.title}"` : `Mark "${task.title}" as completed`}
      aria-pressed={done}
    >
      {done && (
        <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
          <path d="m3.5 8.5 3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

export function TaskRowActions({ task }: { task: Task }) {
  const edit = useEditLink();
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();

  const status = (s: string) =>
    start(async () => {
      const res = await setTaskStatus(task.id, s);
      if (res.ok) toast.success(res.message ?? "Updated");
      else toast.error(res.error);
    });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for "${task.title}"`} disabled={pending}>
            <Ellipsis />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => edit(task.id)}><Pencil /> Edit</DropdownMenuItem>
          {task.status === "pending" && <DropdownMenuItem onSelect={() => status("in_progress")}><Play /> Start</DropdownMenuItem>}
          {task.status !== "completed" ? (
            <DropdownMenuItem onSelect={() => status("completed")}><CircleCheck /> Mark completed</DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => status("pending")}><RotateCcw /> Reopen</DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive onSelect={() => setConfirm(true)}><Trash2 /> Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Delete this task?"
        description={<>&ldquo;{task.title}&rdquo; will be permanently removed.</>}
        pending={pending}
        onConfirm={() =>
          start(async () => {
            const res = await deleteTask(task.id);
            if (res.ok) {
              toast.success("Task deleted");
              setConfirm(false);
            } else toast.error(res.error);
          })
        }
      />
    </>
  );
}

export function EditTitleButton({ task }: { task: Task }) {
  const edit = useEditLink();
  return (
    <button
      type="button"
      onClick={() => edit(task.id)}
      className={`cursor-pointer text-left text-sm font-medium hover:text-accent ${task.status === "completed" ? "text-muted line-through decoration-subtle" : ""}`}
    >
      {task.title}
    </button>
  );
}
