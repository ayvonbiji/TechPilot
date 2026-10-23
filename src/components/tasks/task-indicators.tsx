import { Led, LedLabel, type LedTone } from "@/components/shared/led";
import { labelFor, PRIORITIES, TASK_STATUSES } from "@/lib/constants";
import type { Priority, Task, TaskStatus } from "@/lib/types";

export function isOverdue(task: Pick<Task, "status" | "due_date">, today: string) {
  return task.status !== "completed" && !!task.due_date && task.due_date < today;
}

const statusTone: Record<TaskStatus, LedTone> = { pending: "idle", in_progress: "warn", completed: "ok" };
const priorityTone: Record<Priority, LedTone> = { low: "idle", medium: "info", high: "danger" };

export function StatusLight({ status, overdue }: { status: TaskStatus; overdue?: boolean }) {
  if (overdue) return <LedLabel tone="danger">Overdue</LedLabel>;
  return (
    <LedLabel tone={statusTone[status]} pulse={status === "in_progress"}>
      {labelFor(TASK_STATUSES, status)}
    </LedLabel>
  );
}

export function PriorityMark({ priority, compact }: { priority: Priority; compact?: boolean }) {
  const label = labelFor(PRIORITIES, priority);
  if (compact) {
    return (
      <span className="inline-flex items-center" title={`${label} priority`}>
        <Led tone={priorityTone[priority]} />
        <span className="sr-only">{label} priority</span>
      </span>
    );
  }
  return <LedLabel tone={priorityTone[priority]}>{label}</LedLabel>;
}
