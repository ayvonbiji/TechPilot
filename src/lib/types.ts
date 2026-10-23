export type Priority = "low" | "medium" | "high";
export type TaskStatus = "pending" | "in_progress" | "completed";
export type Theme = "light" | "dark" | "system";
export type DateFormat = "dd MMM yyyy" | "dd/MM/yyyy" | "MM/dd/yyyy" | "yyyy-MM-dd";
export type TimeFormat = "12h" | "24h";

export interface Profile {
  id: string;
  display_name: string;
  theme: Theme;
  timezone: string;
  date_format: DateFormat;
  time_format: TimeFormat;
  created_at: string;
  updated_at: string;
}

interface Owned {
  id: string;
  user_id: string;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Task extends Owned {
  title: string;
  description: string;
  category: string;
  priority: Priority;
  status: TaskStatus;
  due_date: string | null;
  completion_notes: string;
  completed_at: string | null;
}

export interface TroubleshootingRecord extends Owned {
  workspace_id?: string;
  title: string;
  summary?: string;
  problem_description?: string;
  visibility?: "private" | "workspace" | "public";
  category: string;
  status: "investigating" | "resolved";
  symptoms: string;
  possible_causes: string;
  diagnostic_steps: string;
  commands_used: string;
  solution: string;
  verification_steps: string;
  lessons_learned: string;
  tags: string[];
}

export interface Note extends Owned {
  title: string;
  content: string;
  category: string;
  tags: string[];
  is_favorite: boolean;
}

export interface WorkLog extends Owned {
  log_date: string;
  tasks_performed: string;
  problems_investigated: string;
  solutions_outcomes: string;
  skills_learned: string;
  challenges: string;
  follow_up_actions: string;
  reflections: string;
}

export interface Skill extends Owned {
  name: string;
  kind: "skill" | "certification";
  category: string;
  current_level: number;
  target_level: number;
  status: "not_started" | "learning" | "practising" | "completed";
  notes: string;
  resources: string;
  completed_on: string | null;
}

export interface Bookmark extends Owned {
  title: string;
  url: string;
  category: string;
  notes: string;
}

/** Shape every Server Action returns, so forms can show errors consistently. */
export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };
