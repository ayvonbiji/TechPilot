import { z } from "zod";
import {
  BOOKMARK_CATEGORIES,
  DATE_FORMATS,
  KB_CATEGORIES,
  SKILL_CATEGORIES,
} from "@/lib/constants";
import { isValidTimeZone } from "@/lib/dates";
import { oneOf, optionalDate, requiredDate, requiredText, tags, text } from "./common";

// --------------------------------------------------------------- auth
export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address")),
  password: z.string().min(1, "Enter your password"),
});

export const passwordRule = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(72, "Use 72 characters or fewer")
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), "Include at least one letter and one number");

export const signUpSchema = z.object({
  displayName: requiredText("Display name", 80),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address")),
  password: passwordRule,
});

export const emailSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address")),
});

export const newPasswordSchema = z
  .object({ password: passwordRule, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "Passwords don't match", path: ["confirm"] });

// --------------------------------------------------------------- tasks
export const taskSchema = z.object({
  title: requiredText("Title", 200),
  description: text(5000).default(""),
  category: requiredText("Category", 60),
  priority: oneOf(["low", "medium", "high"] as const, "priority"),
  status: oneOf(["pending", "in_progress", "completed"] as const, "status"),
  due_date: optionalDate,
  completion_notes: text(5000).default(""),
});
export type TaskInput = z.input<typeof taskSchema>;

// --------------------------------------------------------------- knowledge base
export const troubleshootingSchema = z
  .object({
    title: requiredText("Problem title", 200),
    category: oneOf(KB_CATEGORIES, "category"),
    status: oneOf(["investigating", "resolved"] as const, "status"),
    symptoms: text(10000).default(""),
    possible_causes: text(10000).default(""),
    diagnostic_steps: text(10000).default(""),
    commands_used: text(10000).default(""),
    solution: text(10000).default(""),
    verification_steps: text(10000).default(""),
    lessons_learned: text(10000).default(""),
    tags,
  })
  .refine((v) => v.symptoms.length > 0, { message: "Describe the symptoms", path: ["symptoms"] })
  .refine((v) => v.status !== "resolved" || v.solution.length > 0, {
    message: "Add the solution, or mark the record as still investigating",
    path: ["solution"],
  });
export type TroubleshootingInput = z.input<typeof troubleshootingSchema>;

// --------------------------------------------------------------- notes
export const noteSchema = z.object({
  title: requiredText("Title", 200),
  content: text(50000).default(""),
  category: requiredText("Category", 60),
  tags,
  is_favorite: z.boolean().default(false),
});
export type NoteInput = z.input<typeof noteSchema>;

// --------------------------------------------------------------- work log
const workLogFields = {
  tasks_performed: text(10000).default(""),
  problems_investigated: text(10000).default(""),
  solutions_outcomes: text(10000).default(""),
  skills_learned: text(10000).default(""),
  challenges: text(10000).default(""),
  follow_up_actions: text(10000).default(""),
  reflections: text(10000).default(""),
};
export const workLogSchema = z
  .object({ log_date: requiredDate, ...workLogFields })
  .refine((v) => Object.keys(workLogFields).some((k) => (v as Record<string, string>)[k].length > 0), {
    message: "Fill in at least one section before saving",
    path: ["tasks_performed"],
  });
export type WorkLogInput = z.input<typeof workLogSchema>;

// --------------------------------------------------------------- skills
export const skillSchema = z
  .object({
    name: requiredText("Name", 120),
    kind: oneOf(["skill", "certification"] as const, "type"),
    category: oneOf(SKILL_CATEGORIES, "category"),
    current_level: z.coerce.number().int().min(0).max(5),
    target_level: z.coerce.number().int().min(1, "Target must be at least 1").max(5),
    status: oneOf(["not_started", "learning", "practising", "completed"] as const, "status"),
    notes: text(5000).default(""),
    resources: text(5000).default(""),
    completed_on: optionalDate,
  })
  .refine((v) => v.status !== "completed" || v.completed_on !== null, {
    message: "Add the date you completed it",
    path: ["completed_on"],
  });
export type SkillInput = z.input<typeof skillSchema>;

// --------------------------------------------------------------- bookmarks
export const bookmarkSchema = z.object({
  title: requiredText("Title", 200),
  url: z
    .string()
    .trim()
    .max(2048, "That URL is too long")
    .refine((v) => {
      try {
        const u = new URL(v);
        return (u.protocol === "https:" || u.protocol === "http:") && !/\s/.test(v);
      } catch {
        return false;
      }
    }, "Enter a full web address starting with https://"),
  category: oneOf(BOOKMARK_CATEGORIES, "category"),
  notes: text(2000).default(""),
});
export type BookmarkInput = z.input<typeof bookmarkSchema>;

// --------------------------------------------------------------- profile
export const profileSchema = z.object({
  display_name: text(80).default(""),
  theme: oneOf(["light", "dark", "system"] as const, "theme"),
  timezone: z.string().trim().min(1).max(64).refine(isValidTimeZone, "Choose a valid time zone"),
  date_format: oneOf(DATE_FORMATS, "date format"),
  time_format: oneOf(["12h", "24h"] as const, "time format"),
});
export type ProfileInput = z.input<typeof profileSchema>;
