import { z } from "zod";
import {
  BOOKMARK_CATEGORIES,
  DATE_FORMATS,
  ALL_KB_CATEGORIES,
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
    category: oneOf(ALL_KB_CATEGORIES, "category"),
    // Optional so an edit that doesn't send them leaves the stored values alone.
    summary: text(500).optional(),
    problem_description: text(10000).optional(),
    visibility: oneOf(["private", "workspace", "public"] as const, "visibility").optional(),
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

// --------------------------------------------------------------- workspaces
export const workspaceCreateSchema = z.object({
  name: requiredText("Name", 80),
  type: oneOf(["freelance", "organisation"] as const, "workspace type"),
  ticket_prefix: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .refine((v) => /^[A-Z]{2,6}$/.test(v), "Use 2–6 letters, e.g. ACME"),
});

export const workspaceUpdateSchema = z.object({
  name: requiredText("Name", 80),
  ticket_prefix: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .refine((v) => /^[A-Z]{2,6}$/.test(v), "Use 2–6 letters, e.g. ACME"),
  brand_color: z
    .string()
    .trim()
    .refine((v) => v === "" || /^#[0-9a-fA-F]{6}$/.test(v), "Use a hex colour like #1f6feb")
    .transform((v) => (v === "" ? null : v.toLowerCase())),
  logo_url: z
    .string()
    .trim()
    .max(1024, "That URL is too long")
    .refine((v) => {
      if (v === "") return true;
      try {
        return new URL(v).protocol === "https:" && !/\s/.test(v);
      } catch {
        return false;
      }
    }, "Use an https:// image address, or leave it empty")
    .transform((v) => (v === "" ? null : v)),
});

export const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address")),
  role: oneOf(["admin", "agent"] as const, "role"),
});

// --------------------------------------------------------------- tickets
const optionalUuid = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => (v ? v.trim() : ""))
  .refine((v) => v === "" || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v), "Choose a valid option")
  .transform((v) => (v === "" ? null : v));

const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .default("")
  .refine((v) => v === "" || z.email().safeParse(v).success, "Enter a valid email address");

export const ticketPriority = oneOf(["low", "medium", "high", "critical"] as const, "priority");
export const ticketStatus = oneOf(
  ["open", "in_progress", "waiting_customer", "waiting_third_party", "resolved", "closed"] as const,
  "status",
);

export const ticketCreateSchema = z.object({
  subject: requiredText("Subject", 200),
  description: text(20000).default(""),
  category: requiredText("Category", 60),
  priority: ticketPriority,
  client_id: optionalUuid,
  requester_id: optionalUuid,
  requester_name: text(120).default(""),
  requester_email: optionalEmail,
  assignee_id: optionalUuid,
  kb_article_id: optionalUuid,
});
export type TicketCreateInput = z.input<typeof ticketCreateSchema>;

export const ticketEditSchema = z.object({
  subject: requiredText("Subject", 200),
  description: text(20000).default(""),
  category: requiredText("Category", 60),
  requester_id: optionalUuid,
  requester_name: text(120).default(""),
  requester_email: optionalEmail,
});

export const ticketStatusSchema = z
  .object({ status: ticketStatus, resolution_summary: text(10000).default("") })
  .refine((v) => v.status !== "resolved" || v.resolution_summary.length > 0, {
    message: "Describe how the issue was resolved",
    path: ["resolution_summary"],
  });

export const commentSchema = z.object({
  body: requiredText("Message", 20000),
  is_internal: z.boolean().default(false),
});

/** Customer-facing ticket form (the portal). Organisation and requester come from the account. */
export const portalTicketSchema = z.object({
  subject: requiredText("Subject", 200),
  description: requiredText("Description", 20000),
  category: requiredText("Category", 60),
  priority: ticketPriority,
});

// --------------------------------------------------------------- clients and SLA
export const clientSchema = z.object({
  name: requiredText("Organisation name", 120),
  email: optionalEmail,
  phone: text(40).default(""),
  address: text(500).default(""),
  primary_contact_name: text(120).default(""),
  primary_contact_email: optionalEmail,
  service_notes: text(5000).default(""),
  notes: text(5000).default(""),
});
export type ClientInput = z.input<typeof clientSchema>;

const slaMinutes = z
  .union([z.number(), z.string(), z.null()])
  .transform((v) => (v === "" || v === null ? null : Number(v)))
  .refine((v) => v === null || (Number.isInteger(v) && v >= 1 && v <= 525600), "Use between 1 minute and 365 days, or leave empty for no target");

export const slaSchema = z.object({
  priority: ticketPriority,
  first_response_minutes: slaMinutes,
  resolution_minutes: slaMinutes,
});

export const customerInviteSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address")),
});

export const automationRuleSchema = z
  .object({
    name: requiredText("Rule name", 80),
    match_category: text(60).default(""),
    match_priority: z.union([ticketPriority, z.literal("")]).default(""),
    action: oneOf(["assign", "notify"] as const, "action"),
    target_user_id: z.string().regex(/^[0-9a-f-]{36}$/i, "Choose a team member"),
    is_active: z.boolean().default(true),
  })
  .transform((v) => ({ ...v, match_category: v.match_category || null, match_priority: v.match_priority || null }));
